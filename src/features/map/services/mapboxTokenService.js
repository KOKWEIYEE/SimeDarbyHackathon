/**
 * Mapbox Token Service
 * Fetches the Mapbox access token securely from the backend server endpoint.
 * Eliminates the need for VITE_MAPBOX_API_KEY in client environment variables.
 */

let cachedToken = null;

/**
 * Loads the Mapbox access token from the backend server (/api/mapbox/token).
 * Caches the token in memory so repeated calls are instant.
 */
export async function getMapboxToken() {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch('/api/mapbox/token');
    if (res.ok) {
      const data = await res.json();
      cachedToken = (data.token || '').trim();
      return cachedToken;
    }
  } catch (err) {
    console.warn('[MapboxToken] Failed to fetch token from backend server:', err.message);
  }
  return '';
}
