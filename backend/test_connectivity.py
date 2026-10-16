import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import app
from backend.connectivity import nearby_stops, walking_route, elevation


class ConnectivityTests(unittest.TestCase):
    def test_candidates_include_rail_and_exclude_entrances(self):
        def feature(i, offset, feed='rapid-bus-kl', kind='0'):
            return {'properties': {'feed': feed, 'stop_id': str(i), 'location_type': kind},
                    'geometry': {'coordinates': [101.7 + offset, 3.15]}}
        rows = [feature(1, .001), feature(1, .001), feature(2, .002), feature(3, .003),
                feature(4, .004, 'rapid-rail-kl'), feature(5, 0, kind='2'), feature(6, .1)]
        with patch('backend.connectivity.transit_data', return_value=rows):
            candidates, count = nearby_stops(3.15, 101.7)
        self.assertEqual(count, 4)
        self.assertEqual(len(candidates), 3)
        self.assertEqual(candidates[-1]['feed'], 'rapid-rail-kl')

    def test_no_route_does_not_invent_distance(self):
        stop = {'latitude': 3.15, 'longitude': 101.7}
        with patch.dict(os.environ, {'MAPBOX_API_KEY': 'test'}), patch('backend.connectivity.urlopen', return_value=io.StringIO('{"code":"NoRoute","routes":[]}')):
            result = walking_route((3.16, 101.71), stop)
        self.assertEqual(result['status'], 'no_route')
        self.assertNotIn('distance_m', result)

    def test_null_dem_is_not_zero_elevation(self):
        rows = [{'latitude': 3.15, 'longitude': 101.7, 'dataset': None, 'elevation': 0}] * 5
        with patch('backend.connectivity.urlopen', return_value=io.StringIO(json.dumps({'results': rows}))):
            self.assertEqual(elevation(3.15, 101.7)['status'], 'unavailable')

    def test_evidence_reaches_ai_but_geometry_is_not_sent(self):
        route = {'id': 'test', 'status': 'available', 'distance_m': 450,
                 'geometry': {'type': 'LineString', 'coordinates': [[101.7, 3.15], [101.71, 3.16]]}}
        advice = {'response_text': 'Check the existing connection.', 'priorities': ['Verify the entrance.'],
                  'field_checks': ['Inspect crossings.']}
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), \
             patch('backend.connectivity.nearby_stops', return_value=([{}], 3)), \
             patch('backend.connectivity.walking_route', return_value=route), \
             patch('backend.connectivity.elevation', return_value={'status': 'unavailable'}), \
             patch('backend.connectivity.OpenAI') as model:
            model.return_value.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(advice)))])
            response = TestClient(app).post('/api/connectivity', json={'message': 'Check connections', 'latitude': 3.15, 'longitude': 101.7})
            sent = json.loads(model.return_value.chat.completions.create.call_args.kwargs['messages'][1]['content'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sent['evidence']['routes'][0]['distance_m'], 450)
        self.assertNotIn('geometry', sent['evidence']['routes'][0])
        self.assertIn('geometry', response.json()['routes'][0])
        self.assertNotIn('estimated_cost', response.json())

    def test_outside_pilot_rejected(self):
        response = TestClient(app).post('/api/connectivity', json={'message': 'Check', 'latitude': 1.3, 'longitude': 103.8})
        self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()
