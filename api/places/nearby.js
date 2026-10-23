/**
 * Vercel Serverless Function: POST /api/places/nearby
 * Proxies Google Places Nearby Search API with auto-sanitization and retry logic.
 */
import { handlePlacesNearbyRoute } from '../../server.js';

export default async function handler(req, res) {
  return handlePlacesNearbyRoute(req, res);
}
