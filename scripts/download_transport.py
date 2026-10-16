"""Download official KL-region GTFS feeds and convert stops to GeoJSON.

Run: python scripts/download_transport.py
Uses only the Python standard library. No API key required.
"""
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'transport'
CATEGORIES = ['rapid-rail-kl', 'rapid-bus-kl', 'rapid-bus-mrtfeeder']


def download():
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest = {'source': 'https://developer.data.gov.my/realtime-api/gtfs-static',
                'scope': 'Operator feeds cover the wider KL/Klang Valley region, not a clipped DBKL boundary.',
                'feeds': []}
    features = []
    failures = []
    for category in CATEGORIES:
        url = 'https://api.data.gov.my/gtfs-static/prasarana?category=' + category
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Abso-KL-Hackathon/1.0'}), timeout=60) as response:
                payload = response.read()
            with ZipFile(io.BytesIO(payload)) as archive:
                if archive.testzip():
                    raise ValueError('ZIP integrity check failed')
                tables = {}
                for table in ['agency', 'stops', 'routes', 'trips', 'calendar', 'calendar_dates', 'feed_info']:
                    if table + '.txt' in archive.namelist():
                        text = archive.read(table + '.txt').decode('utf-8-sig')
                        tables[table] = list(csv.DictReader(io.StringIO(text)))
                        (ROOT / f'{category}-{table}.csv').write_text(text, encoding='utf-8')
                for stop in tables.get('stops', []):
                    try:
                        lat, lon = float(stop['stop_lat']), float(stop['stop_lon'])
                        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                            continue
                    except (ValueError, KeyError):
                        continue
                    features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                                     'properties': {**stop, 'feed': category, 'source': 'data.gov.my / Prasarana'}})
                files = archive.namelist()
            (ROOT / f'{category}.zip').write_bytes(payload)
            record = {'category': category, 'url': url, 'retrieved_at_utc': datetime.now(timezone.utc).isoformat(),
                      'bytes': len(payload), 'files': files, 'counts': {k: len(v) for k, v in tables.items()},
                      'feed_info': tables.get('feed_info', [])}
            manifest['feeds'].append(record)
            print(category, json.dumps(record['counts']))
        except Exception as error:
            failures.append(category)
            manifest['feeds'].append({'category': category, 'url': url, 'error': type(error).__name__})
            print(category, 'failed:', type(error).__name__)
    (ROOT / 'stops.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False), encoding='utf-8')
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('GeoJSON stop features:', len(features))
    if failures:
        raise SystemExit('Failed feeds: ' + ', '.join(failures))


if __name__ == '__main__':
    download()
