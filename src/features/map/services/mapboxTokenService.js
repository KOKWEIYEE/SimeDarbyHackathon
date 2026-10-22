import { mapboxConfig } from '../../../../config.js';

let cachedToken = null;

/**
 * Loads the Mapbox access token from frontend config or backend.
 */
export async function getMapboxToken() {
  if (cachedToken) return cachedToken;
  if (mapboxConfig?.token) {
    cachedToken = mapboxConfig.token;
    return cachedToken;
  }
  try {
    const res = await fetch('/api/mapbox/token');
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        cachedToken = data.token.trim();
        return cachedToken;
      }
    }
  } catch (err) {
    console.warn('[MapboxToken] Backend token query failed:', err.message);
  }
  return '';
}
