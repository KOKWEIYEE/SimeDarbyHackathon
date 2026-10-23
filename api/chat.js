/**
 * Vercel Serverless Function: POST /api/chat
 * Handles conversational AI requests on Vercel deployments.
 */
import { handleChatRoute } from '../server.js';

export default async function handler(req, res) {
  return handleChatRoute(req, res);
}
