export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchPlace(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimeDarbyGIS/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed with status ${res.status}`);
  }

  const results = await res.json();
  if (!results || results.length === 0) {
    return null;
  }

  const first = results[0];
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);

  return {
    name: first.display_name,
    shortName: first.name || first.display_name.split(',')[0],
    lat,
    lon,
    coords: [lon, lat],
    type: first.type || 'Location',
  };
}
