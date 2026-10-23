/**
 * Vercel Serverless Function: POST /api/places/search
 * Proxies Google Places Text Search API securely using GOOGLE_API_KEY.
 */
import { handlePlacesSearchRoute } from '../../server.js';

export default async function handler(req, res) {
  return handlePlacesSearchRoute(req, res);
}
