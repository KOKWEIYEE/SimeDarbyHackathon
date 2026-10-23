/**
 * Vercel Serverless Function: GET /api/mapbox/token
 * Provides the Mapbox access token on Vercel deployments.
 */
import { handleMapboxTokenRoute } from '../../server.js';

export default function handler(req, res) {
  return handleMapboxTokenRoute(req, res);
}
