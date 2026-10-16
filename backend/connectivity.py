"""Point-to-transit screening with measured routes and explicit evidence gaps."""
import json
import math
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from openai import OpenAI, APIStatusError, APIConnectionError
from pydantic import BaseModel, Field, ValidationError
from backend.spatial import distance_m

router = APIRouter()
ROOT = Path(__file__).resolve().parents[1]


class ConnectivityRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    latitude: float = Field(ge=3.0, le=3.3)
    longitude: float = Field(ge=101.55, le=101.85)
    site_name: str = Field(default='Selected location', max_length=100)


class Advice(BaseModel):
    response_text: str = Field(min_length=1, max_length=6000)
    priorities: list[str] = Field(min_length=1, max_length=5)
    field_checks: list[str] = Field(min_length=1, max_length=6)


@lru_cache(maxsize=1)
def transit_data():
    return json.loads((ROOT / 'data/transport/stops.geojson').read_text(encoding='utf-8-sig'))['features']


def nearby_stops(lat, lon):
    stops = {}
    for feature in transit_data():
        p = feature.get('properties', {})
        if str(p.get('location_type', '0')) not in ('', '0', '1'):
            continue
        try:
            x, y = feature['geometry']['coordinates']
            d = distance_m((lat, lon), (y, x))
            key = (p['feed'], p['stop_id'])
            stops[key] = {'id': ':'.join(key), 'name': p.get('stop_name') or p['stop_id'],
                'feed': p['feed'], 'latitude': y, 'longitude': x, 'straight_distance_m': round(d)}
        except (KeyError, ValueError, TypeError):
            continue
    ordered = sorted(stops.values(), key=lambda s: s['straight_distance_m'])
    # Keep both bus and rail represented when available within the screening radius.
    candidates = [s for s in ordered if s['straight_distance_m'] <= 2000]
    selected = candidates[:3]
    rail = next((s for s in candidates if s['feed'] == 'rapid-rail-kl'), None)
    if rail and rail not in selected:
        selected = selected[:2] + [rail]
    return selected, sum(s['straight_distance_m'] <= 800 for s in ordered)


def walking_route(origin, stop):
    result = {**stop, 'status': 'unavailable', 'source': 'Mapbox Directions / walking'}
    key = (os.getenv('MAPBOX_API_KEY') or os.getenv('VITE_MAPBOX_API_KEY') or '').strip()
    if not key:
        return {**result, 'reason': 'Mapbox token not configured.'}
    coordinates = f"{origin[1]},{origin[0]};{stop['longitude']},{stop['latitude']}"
    url = 'https://api.mapbox.com/directions/v5/mapbox/walking/' + coordinates + '?' + urlencode({
        'access_token': key, 'geometries': 'geojson', 'overview': 'full', 'steps': 'false', 'radiuses': '100;100'})
    try:
        with urlopen(url, timeout=10) as response:
            data = json.load(response)
        if data.get('code') != 'Ok' or not data.get('routes'):
            return {**result, 'status': 'no_route', 'reason': 'No route returned within the 100 m snapping limit. This does not prove a missing footpath.'}
        route = data['routes'][0]
        if route['geometry']['type'] != 'LineString' or len(route['geometry']['coordinates']) < 2:
            raise ValueError('Invalid geometry')
        if not all(math.isfinite(route[k]) and route[k] >= 0 for k in ('distance', 'duration')):
            raise ValueError('Invalid metrics')
        return {**result, 'status': 'available', 'distance_m': round(route['distance']),
                'duration_minutes': round(route['duration']/60, 1), 'geometry': route['geometry'],
                'snapped_waypoints': [{'coordinates': w['location'], 'offset_m': round(w.get('distance', 0), 1)} for w in data.get('waypoints', [])],
                'retrieved_at_utc': datetime.now(timezone.utc).isoformat()}
    except HTTPError as error:
        return {**result, 'reason': f'Routing request failed (HTTP {error.code}). Check Mapbox access or usage.'}
    except Exception:
        return {**result, 'reason': 'Routing service unavailable; no walking distance inferred.'}


def elevation(lat, lon):
    headers = {'Content-Type': 'application/json'}
    key = os.getenv('OPEN_ELEVATION_API') or os.getenv('OPEN_ELEVATION_API_KEY')
    if key:
        headers['X-API-Key'] = key.strip()
    points = [(lat, lon), (lat+.001, lon), (lat-.001, lon), (lat, lon+.001), (lat, lon-.001)]
    req = Request('https://api.open-elevation.com/api/v1/lookup', headers=headers, data=json.dumps({
        'locations': [{'latitude': a, 'longitude': b} for a, b in points], 'dataset': 'auto'}).encode())
    try:
        with urlopen(req, timeout=10) as response:
            rows = json.load(response)['results']
        if len(rows) != 5 or not all(r.get('dataset') and isinstance(r.get('elevation'), (int, float)) and math.isfinite(r['elevation'])
            and abs(r.get('latitude',999)-a) < .00001 and abs(r.get('longitude',999)-b) < .00001 for r, (a,b) in zip(rows, points)):
            raise ValueError('Missing elevation')
        values = [r['elevation'] for r in rows]
        return {'status': 'available', 'center_elevation_m': round(values[0],1), 'sample_min_m': round(min(values),1),
                'sample_max_m': round(max(values),1), 'datasets': sorted({r['dataset'] for r in rows}),
                'source': 'Open-Elevation / SRTM', 'retrieved_at_utc': datetime.now(timezone.utc).isoformat()}
    except Exception:
        return {'status': 'unavailable', 'source': 'Open-Elevation', 'reason': 'Elevation lookup unavailable.'}


@router.post('/api/connectivity')
def connectivity(request: ConnectivityRequest):
    if not request.message.strip():
        raise HTTPException(422, 'Enter a connectivity question.')
    if not os.getenv('GEMINI_API_KEY'):
        raise HTTPException(503, 'Configure GEMINI_API_KEY and restart the backend.')
    try:
        stops, count = nearby_stops(request.latitude, request.longitude)
    except (OSError, ValueError, KeyError):
        raise HTTPException(503, 'Local GTFS data is unavailable. Run scripts/download_transport.py.') from None
    with ThreadPoolExecutor(max_workers=4) as pool:
        terrain_future = pool.submit(elevation, request.latitude, request.longitude)
        jobs = [pool.submit(walking_route, (request.latitude, request.longitude), s) for s in stops]
        routes = [job.result() for job in jobs]
        terrain = terrain_future.result()
    assumptions = [
        'Origin is the selected study point, not a verified parcel entrance. Pilot extent is a KL-area bounding box, not the legal city boundary.',
        'GTFS stop positions can represent station centres/platforms, not accessible entrances. Stop records can refer to the same physical station.',
        'Three candidate records at most, within 2 km straight-line; rail included when available. This is not an exhaustive fastest-route search.',
        'Mapbox walking distances and durations are modelled route estimates. Check waypoint snapping; unmodelled access to the snapped road is not included.',
        'A returned route does not establish continuous sidewalks, safe crossings, shade, step-free access or permission to enter. No route is not proof that a walkway is absent.',
        'Terrain uses five coarse DEM samples: the origin and approximately 110 m north/south/east/west. These are not route slopes, surveyed levels, or flood predictions.',
        'Field checks required: sidewalks, crossings, fences, access restrictions, shade and accessibility. Current service frequency has not been evaluated.',
        'No construction costs or automatic carbon savings are claimed. Material comparison requires user-provided quantities and compatible sourced carbon factors.'
    ]
    try:
        manifest = json.loads((ROOT / 'data/transport/manifest.json').read_text())
        assumptions.append('GTFS snapshot: ' + '; '.join(f"{f['category']} retrieved {f.get('retrieved_at_utc','unknown')}" for f in manifest['feeds']))
    except (OSError, ValueError, KeyError):
        assumptions.append('GTFS snapshot date unavailable.')
    evidence = {'origin': {'latitude': request.latitude, 'longitude': request.longitude, 'name': request.site_name},
                'nearby_stop_records': count, 'routes': routes, 'terrain': terrain, 'assumptions': assumptions}
    # Large route geometries are displayed on the map, not sent as model tokens.
    model_evidence = {**evidence, 'routes': [{k:v for k,v in r.items() if k != 'geometry'} for r in routes]}
    system = '''You are a KL public transport connectivity analyst. Return JSON with response_text (string),
priorities (1-5 strings), field_checks (1-6 strings). Answer in the user's language. The selected coordinates
are authoritative; never relocate based on a named place in the prompt. If the user wants another place,
ask them to select it. Use only supplied evidence, cite sources naturally. Compare available walking
routes and distinguish route distance from straight-line distance. Missing routes/data are unknowns.
Never infer a missing sidewalk, fence, unsafe crossing or steep route from these data. Coarse DEM is not
route gradient. Do not automatically recommend building a walkway. Consider maintaining existing links,
targeted improvements subject to field checks, or studying a shuttle. Existing links may need no new works,
but never declare safety or accessibility verified. Do not invent carbon savings, cost, ridership or zoning.
If asked about materials, request quantities, units, baseline and proposed emission factors and source.
Describe preliminary priorities and explicit evidence gaps. Keep response concise.'''
    try:
        client = OpenAI(api_key=os.getenv('GEMINI_API_KEY'), base_url='https://generativelanguage.googleapis.com/v1beta/openai/', timeout=40, max_retries=0)
        response = client.chat.completions.create(model=os.getenv('GEMINI_MODEL','gemini-3.1-flash-lite'),
            messages=[{'role':'system','content':system},{'role':'user','content':json.dumps({'question':request.message,'evidence':model_evidence},ensure_ascii=False)}],
            response_format={'type':'json_object'}, max_tokens=3000, reasoning_effort='low')
        advice = Advice.model_validate_json(response.choices[0].message.content or '')
    except APIStatusError as error:
        raise HTTPException(503, f'Gemini request failed (HTTP {error.status_code}). Check key/quota for 400/401/403/429; retry later for 5xx.') from None
    except APIConnectionError:
        raise HTTPException(504, 'Gemini could not respond in time. Please retry.') from None
    except (ValidationError, ValueError, IndexError):
        raise HTTPException(502, 'Gemini returned an incomplete analysis. Please retry.') from None
    return {**evidence, **advice.model_dump(), 'mode':'ai'}
