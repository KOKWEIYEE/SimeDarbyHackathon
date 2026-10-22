/**
 * Vercel Serverless Function: POST /api/places/search
 * Proxies Google Places Text Search API securely using GOOGLE_API_KEY.
 */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const googleApiKey = (process.env.GOOGLE_API_KEY || '').trim();

  try {
    const { textQuery, maxResultCount = 5 } = req.body || {};

    if (!textQuery) {
      return res.status(400).json({ error: 'Missing textQuery in request body.' });
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.location,places.formattedAddress,places.shortFormattedAddress,places.types',
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount,
        locationBias: {
          circle: {
            center: { latitude: 3.1390, longitude: 101.7069 },
            radius: 50000,
          },
        },
      }),
    });

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[Vercel API] Places Search Error:', err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: err.message });
  }
}
