import unittest
from unittest.mock import patch
from backend import spatial


class SpatialTests(unittest.TestCase):
    def test_distance_and_records(self):
        self.assertEqual(spatial.distance_m((3, 101), (3, 101)), 0)
        self.assertAlmostEqual(spatial.distance_m((0, 0), (0, 1)), 111195, delta=10)
        f = {'geometry': {'coordinates': [101, 3]}, 'properties': {'feed': 'rail', 'stop_id': 'a', 'stop_name': 'Station'}}
        result = spatial.transit_context((3, 101), [f, f])
        self.assertEqual(result['nearby_stop_records'], 1)
        self.assertEqual(result['nearest'][0]['distance_m'], 0)

    def test_elevation_failure_preserves_transit(self):
        with patch.object(spatial, '_cache', None), patch.object(spatial, 'urlopen', side_effect=OSError):
            result = spatial.get_spatial_context()
        self.assertEqual(result['klcc']['terrain']['status'], 'unavailable')
        self.assertEqual(result['klcc']['transit']['status'], 'available')

    def test_null_dataset_is_not_zero_elevation(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.object(spatial, '_cache', None), patch.object(spatial, 'urlopen', return_value=Response()), patch.object(spatial.json, 'load', return_value={'results': [{'dataset': None, 'elevation': 0}]*15}):
            result = spatial.get_spatial_context()
        self.assertEqual(result['klcc']['terrain']['status'], 'unavailable')

if __name__ == '__main__':
    unittest.main()
