/**
 * Vercel Serverless Function: GET /api/health
 * Checks AI backend configuration status on Vercel deployments.
 */
import { handleHealthRoute } from '../server.js';

export default async function handler(req, res) {
  return handleHealthRoute(req, res);
}
