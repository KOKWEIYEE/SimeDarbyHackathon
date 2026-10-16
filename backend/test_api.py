import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import app


class PlanningAPI(unittest.TestCase):
    def setUp(self):
        evidence = {site: {'terrain': {'status': 'unavailable', 'source': 'Open-Elevation', 'reason': 'Test unavailable'},
                          'transit': {'status': 'available', 'source': 'GTFS', 'method': 'Straight-line'}}
                    for site in ('klcc', 'sentral', 'kampung-baru')}
        patcher = patch('backend.main.get_spatial_context', return_value=evidence)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)
        self.input = {'message': 'Plan a 500m walkway', 'length': 500, 'width': 2, 'budget': 150000, 'carbon_target': 30}

    def mock_reply(self, **overrides):
        parsed = {**self.input, 'site_id': 'klcc', 'strategy_id': 'walkway', 'response_text': 'Consider permeable paving.', 'out_of_scope': False, **overrides}
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(parsed)))])

    def test_valid_ai_response_and_calculation(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), patch('backend.main.OpenAI') as client:
            client.return_value.chat.completions.create.return_value = self.mock_reply()
            response = self.client.post('/api/chat', json=self.input)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['kpi_metrics']['estimated_cost'], 145000)
        self.assertEqual(data['kpi_metrics']['carbon_reduction'], 32)
        self.assertEqual(data['kpi_metrics']['carbon_saved'], 16000)
        self.assertIsNone(data['kpi_metrics']['flood_resilience_boost'])
        self.assertEqual(data['action_zone']['coordinates'][0], [3.1505, 101.7115])
        self.assertEqual(data['spatial_context']['transit']['source'], 'GTFS')
        sent = client.return_value.chat.completions.create.call_args.kwargs['messages'][1]['content']
        self.assertIn('spatial_context', json.loads(sent))

    def test_invalid_input(self):
        for extra in ({'width': -1}, {'carbon_target': 101}, {'site_id': 'elmina'}, {'message': ''}):
            self.assertEqual(self.client.post('/api/chat', json={**self.input, **extra}).status_code, 422)

    def test_missing_credentials(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': ''}):
            self.assertEqual(self.client.post('/api/chat', json=self.input).status_code, 503)

    def test_invalid_model_output(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), patch('backend.main.OpenAI') as client:
            client.return_value.chat.completions.create.return_value = self.mock_reply(width=-3)
            self.assertEqual(self.client.post('/api/chat', json=self.input).status_code, 502)

    def test_out_of_scope(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), patch('backend.main.OpenAI') as client:
            client.return_value.chat.completions.create.return_value = self.mock_reply(out_of_scope=True)
            self.assertEqual(self.client.post('/api/chat', json=self.input).status_code, 422)

    def test_prompt_override(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), patch('backend.main.OpenAI') as client:
            client.return_value.chat.completions.create.return_value = self.mock_reply(length=1000)
            data = self.client.post('/api/chat', json=self.input).json()
        self.assertEqual(data['kpi_metrics']['estimated_cost'], 290000)
        self.assertIn('Above budget', data['response_text'])


if __name__ == '__main__':
    unittest.main()
