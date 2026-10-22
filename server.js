/**
 * Secure Backend Server for Sime Darby GIS AI Assistant.
 *
 * Architecture:
 * 1. Frontend (Vite) sends chat prompt and spatial context to backend: POST /api/chat.
 * 2. Backend reads private AI_API_KEY securely from process.env (without VITE_ prefix).
 * 3. Backend makes the server-to-AI request to OpenAI or Gemini and returns response to frontend.
 *
 * Can be run standalone:
 *   node server.js
 * Or imported as a Vite dev server plugin in vite.config.js for zero-configuration development.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads .env key-value pairs into process.env on the server.
 */
export function loadEnvFiles() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    } catch (err) {
      console.warn('[AI Backend] Warning loading .env file:', err.message);
    }
  }
}

// Initial environment load
loadEnvFiles();

/**
 * Returns the resolved AI credentials and provider configuration.
 */
export function getBackendAiConfig() {
  loadEnvFiles();

  const apiKey = (
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();

  let provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (!provider) {
    if (apiKey.startsWith('sk-')) {
      provider = 'openai';
    } else if (apiKey.startsWith('AQ.') || apiKey.startsWith('AIzaSy')) {
      provider = 'gemini';
    } else {
      provider = 'openai';
    }
  }

  const model = (
    process.env.AI_MODEL ||
    (provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini')
  ).trim();

  return {
    apiKey,
    provider,
    model,
    endpoint: (process.env.AI_API_ENDPOINT || '').trim(),
    isConfigured: Boolean(
      apiKey && apiKey.length > 5 && !apiKey.includes('your_ai_model_api_key')
    ),
  };
}

/**
 * Calls OpenAI chat completion endpoint from the backend server.
 */
async function callServerOpenAi({ apiKey, model, prompt, messages = [], systemInstruction }) {
  const historyFormatted = messages.slice(-10).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const payload = {
    model: model || 'gpt-4o-mini',
    messages: [
      ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
      ...historyFormatted,
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 800,
  };

  const endpoint = process.env.AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[AI Backend] OpenAI error:', res.status, errorText);
    throw new Error(`OpenAI HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('Empty response received from OpenAI.');
  }

  return {
    text: reply,
    source: 'backend_live_api',
    model,
    provider: 'openai',
  };
}

/**
 * Calls Google Gemini REST API from the backend server.
 */
async function callServerGemini({ apiKey, model, prompt, messages = [], systemInstruction }) {
  const candidateModels = [
    ...(model ? [model] : []),
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.5-flash',
    'gemini-3.8-flash',
  ];
  const uniqueModels = [...new Set(candidateModels)];

  const historyFormatted = messages.slice(-10).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const payload = {
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    contents: [
      ...historyFormatted,
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  };

  for (const m of uniqueModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[AI Backend] Gemini model ${m} HTTP ${res.status}:`, errorText);
        continue;
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (reply) {
        return {
          text: reply,
          source: 'backend_live_api',
          model: m,
          provider: 'gemini',
        };
      }
    } catch (err) {
      console.warn(`[AI Backend] Gemini model ${m} failed:`, err.message);
    }
  }

  throw new Error('All Gemini candidate models failed to return a response.');
}

/**
 * Server-side AI orchestration handler.
 */
export async function executeAiChat({ prompt, messages = [], context = {}, systemInstruction }) {
  const config = getBackendAiConfig();

  if (!config.isConfigured) {
    throw new Error(
      'AI_API_KEY is not configured on the backend server. Please define AI_API_KEY in your .env file.'
    );
  }

  if (config.provider === 'gemini') {
    return await callServerGemini({
      apiKey: config.apiKey,
      model: config.model,
      prompt,
      messages,
      systemInstruction,
    });
  }

  return await callServerOpenAi({
    apiKey: config.apiKey,
    model: config.model,
    prompt,
    messages,
    systemInstruction,
  });
}

/**
 * Reads and parses JSON body from an incoming HTTP request stream.
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to write JSON responses with proper CORS headers.
 */
export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(payload));
}

/**
 * Route handler for POST /api/chat.
 */
export async function handleChatRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { prompt, messages = [], context = {}, systemInstruction } = body;

    if (!prompt || typeof prompt !== 'string') {
      return sendJson(res, 400, { error: 'Missing prompt in request body.' });
    }

    const aiResult = await executeAiChat({
      prompt,
      messages,
      context,
      systemInstruction,
    });

    return sendJson(res, 200, aiResult);
  } catch (err) {
    console.error('[AI Backend] Chat execution error:', err.message);
    return sendJson(res, 500, {
      error: err.message || 'Internal AI service error',
      source: 'backend_error',
    });
  }
}

/**
 * Route handler for GET /api/health.
 */
export function handleHealthRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  const config = getBackendAiConfig();
  return sendJson(res, 200, {
    status: 'ok',
    configured: config.isConfigured,
    provider: config.provider,
    model: config.model,
    backendSecured: true,
  });
}

/**
 * Route handler for POST /api/places/nearby (hides private Google API key on backend)
 */
export async function handlePlacesNearbyRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  loadEnvFiles();
  const googleApiKey = (process.env.GOOGLE_API_KEY || '').trim();

  try {
    const body = await readJsonBody(req);
    const { includedTypes, maxResultCount = 20, locationRestriction } = body;

    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.location,places.types,places.primaryType,places.formattedAddress,places.shortFormattedAddress,places.addressComponents,places.viewport',
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount,
        locationRestriction,
      }),
    });

    const data = await response.json();
    return sendJson(res, response.status, data);
  } catch (err) {
    console.error('[Backend] Places Nearby Error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * Route handler for POST /api/routes/transit (hides private Google API key on backend)
 */
export async function handleRoutesComputeRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  loadEnvFiles();
  const googleApiKey = (process.env.GOOGLE_API_KEY || '').trim();

  if (!googleApiKey) {
    return sendJson(res, 400, {
      error: 'GOOGLE_API_KEY is not configured on the backend server. Please define GOOGLE_API_KEY in .env.',
    });
  }

  try {
    const body = await readJsonBody(req);
    const { origin, destination, travelMode = 'TRANSIT', fieldMask } = body;

    const defaultMask =
      'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails';

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask || defaultMask,
      },
      body: JSON.stringify({
        origin,
        destination,
        travelMode,
      }),
    });

    const data = await response.json();
    return sendJson(res, response.status, data);
  } catch (err) {
    console.error('[Backend] Google Routes Error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * Route handler for GET /api/mapbox/token (reads process.env.MAPBOX_API_KEY securely on the server)
 */
export function handleMapboxTokenRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  loadEnvFiles();
  const token = (
    process.env.MAPBOX_API_KEY ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_TOKEN ||
    ''
  ).trim();

  return sendJson(res, 200, {
    token,
    configured: Boolean(token && token.length > 10),
  });
}

/**
 * Vite Dev Server Plugin: embeds backend AI and Google/Mapbox API endpoints into Vite dev server.
 */
export function aiBackendPlugin() {
  return {
    name: 'ai-backend-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url === '/api/chat' || url === '/api/ai/chat') {
          return handleChatRoute(req, res);
        }
        if (url === '/api/health' || url === '/api/ai/health') {
          return handleHealthRoute(req, res);
        }
        if (url === '/api/places/nearby') {
          return handlePlacesNearbyRoute(req, res);
        }
        if (url === '/api/routes/transit' || url === '/api/routes/compute') {
          return handleRoutesComputeRoute(req, res);
        }
        if (url === '/api/mapbox/token' || url === '/api/config/mapbox') {
          return handleMapboxTokenRoute(req, res);
        }
        next();
      });
    },
  };
}

/**
 * Standalone HTTP server runner.
 */
export function startServer(port = process.env.PORT || 3001) {
  const server = http.createServer((req, res) => {
    const url = req.url ? req.url.split('?')[0] : '';

    if (url === '/api/chat' || url === '/api/ai/chat') {
      return handleChatRoute(req, res);
    }
    if (url === '/api/health' || url === '/api/ai/health') {
      return handleHealthRoute(req, res);
    }
    if (url === '/api/places/nearby') {
      return handlePlacesNearbyRoute(req, res);
    }
    if (url === '/api/routes/transit' || url === '/api/routes/compute') {
      return handleRoutesComputeRoute(req, res);
    }
    if (url === '/api/mapbox/token' || url === '/api/config/mapbox') {
      return handleMapboxTokenRoute(req, res);
    }

    sendJson(res, 404, { error: 'Not Found' });
  });

  server.listen(port, () => {
    console.log(`[AI Backend Server] Listening securely at http://localhost:${port}`);
    console.log(`[AI Backend Server] Route POST /api/chat is ready`);
  });

  return server;
}

// If executed directly with `node server.js`
const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  startServer();
}
