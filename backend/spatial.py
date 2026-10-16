"""Source-backed spatial context; no inferred flood or walking-time scores."""
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
_cache = None
_cached_at = 0
_lock = Lock()


def distance_m(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [*a, *b])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000 * 2 * math.asin(math.sqrt(min(1, h)))


def transit_context(center, features):
    stops = {}
    for feature in features:
        p = feature.get('properties', {})
        if str(p.get('location_type', '0')) not in ('', '0', '1'):
            continue
        try:
            lon, lat = feature['geometry']['coordinates']
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            key = (p.get('feed'), p['stop_id'])
            stops[key] = {'name': p.get('stop_name') or p['stop_id'], 'feed': p.get('feed'),
                          'distance_m': round(distance_m(center, (lat, lon))), 'stop_id': p['stop_id']}
        except (KeyError, TypeError, ValueError):
            continue
    nearest = sorted(stops.values(), key=lambda s: s['distance_m'])
    return {'status': 'available' if nearest else 'unavailable', 'source': 'data.gov.my / Prasarana GTFS static',
            'radius_m': 800, 'nearby_stop_records': sum(s['distance_m'] <= 800 for s in nearest),
            'nearest': nearest[:3], 'method': 'Straight-line distance from study-area centre; stop records may share a physical station. Not walking time or live service frequency.'}


def get_spatial_context():
    global _cache, _cached_at
    with _lock:
        if _cache is not None and time.monotonic() - _cached_at < 600:
            return _cache
        sites = json.loads((ROOT / 'src/features/ai/catalog.json').read_text(encoding='utf-8-sig'))['sites']
        try:
            features = json.loads((ROOT / 'data/transport/stops.geojson').read_text(encoding='utf-8-sig'))['features']
            manifest = json.loads((ROOT / 'data/transport/manifest.json').read_text())
            retrieved = [f.get('retrieved_at_utc') for f in manifest['feeds'] if f.get('retrieved_at_utc')]
        except (OSError, ValueError, KeyError):
            features, retrieved = [], []
        contexts, locations = {}, []
        for site in sites:
            coords = site['coordinates']
            center = [sum(c[i] for c in coords)/len(coords) for i in range(2)]
            contexts[site['id']] = {'site_name': site['name'], 'center_lat_lon': center,
                'transit': {**transit_context(center, features), 'snapshot_retrieved_at_utc': retrieved},
                'terrain': {'status': 'unavailable', 'source': 'Open-Elevation', 'reason': 'Elevation lookup unavailable.'}}
            locations.extend({'latitude': c[0], 'longitude': c[1]} for c in [center, *coords])
        key = (os.getenv('OPEN_ELEVATION_API') or os.getenv('OPEN_ELEVATION_API_KEY') or '').strip()
        headers = {'Content-Type': 'application/json'}
        if key:
            headers['X-API-Key'] = key
        request = Request('https://api.open-elevation.com/api/v1/lookup',
            data=json.dumps({'locations': locations, 'dataset': 'auto'}).encode(), headers=headers)
        try:
            with urlopen(request, timeout=8) as response:
                rows = json.load(response)['results']
            if len(rows) != len(locations):
                raise ValueError('Incomplete response')
            offset = 0
            for site in sites:
                count = len(site['coordinates']) + 1
                samples = rows[offset:offset+count]
                requested = locations[offset:offset+count]
                offset += count
                valid = all(r.get('dataset') and isinstance(r.get('elevation'), (float, int))
                    and math.isfinite(r['elevation'])
                    and abs(r.get('latitude', 999)-q['latitude']) < 0.00001
                    and abs(r.get('longitude', 999)-q['longitude']) < 0.00001 for r, q in zip(samples, requested))
                if not valid:
                    continue
                elevations = [r['elevation'] for r in samples]
                contexts[site['id']]['terrain'] = {'status': 'available', 'source': 'Open-Elevation / SRTM',
                    'center_elevation_m': round(elevations[0], 1), 'sample_min_m': round(min(elevations), 1),
                    'sample_max_m': round(max(elevations), 1), 'sample_count': count,
                    'datasets': sorted(set(r['dataset'] for r in samples)),
                    'retrieved_at_utc': datetime.now(timezone.utc).isoformat(),
                    'method': 'DEM samples at centre and polygon vertices. Sample range is not whole-site extrema; coarse grid is not a survey or flood-risk assessment.'}
        except Exception:
            # External data failure must not fabricate measurements or stop chat.
            pass
        _cache, _cached_at = contexts, time.monotonic()
        return contexts
