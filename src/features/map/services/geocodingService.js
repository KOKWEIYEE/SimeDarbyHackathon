import railStations from './rail-stations.json' with { type: 'json' };
let lastRequest = 0;
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function findRailStation(query) {
  const normalized = normalize(query);
  const mode = normalized.match(/\b(mrt|lrt|monorail)\b/)?.[1];
  const name = normalized.replace(/\b(mrt|lrt|monorail|station|stesen)\b/g, '').replace(/\s+/g, ' ').trim();
  const matches = railStations.stations.filter(station => normalize(station.name) === name && (!mode || normalize(station.mode) === mode));
  if (matches.length !== 1) return null;
  const station = matches[0], [lon, lat] = station.coords;
  return { name: `${station.mode} ${station.name} (${station.id}) - station reference point`, shortName: `${station.mode} ${station.name}`, lat, lon, coords: [lon, lat], type: 'Rail station', source: railStations.source, note: 'GTFS station coordinate; not a verified entrance. Check the entrance before routing.' };
}
// Text coordinates use latitude, longitude; Mapbox geometry uses longitude, latitude.
export function parseCoordinates(query) {
  const match = String(query || '').trim().match(/^(?:Custom Location\s*)?\(?\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/i);
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new Error('Invalid coordinates. Use latitude (-90 to 90), longitude (-180 to 180).');
  const name = `${lat}, ${lon}`;
  return {name, shortName:name, lat, lon, coords:[lon, lat], type:'Coordinates'};
}

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Converts Malaysian/Malay street terms and administrative prefixes to standard English.
 */
export function toEnglishAddress(addr) {
  if (!addr) return '';
  return addr
    .replace(/\bJalan\b/gi, 'Road')
    .replace(/\bJln\.?\b/gi, 'Road')
    .replace(/\bPersiaran\b/gi, 'Avenue')
    .replace(/\bLebuhraya\b/gi, 'Expressway')
    .replace(/\bLebuh\b/gi, 'Street')
    .replace(/\bLorong\b/gi, 'Lane')
    .replace(/\bLingkaran\b/gi, 'Circle')
    .replace(/\bMedan\b/gi, 'Square')
    .replace(/\bKompleks\b/gi, 'Complex')
    .replace(/\bPasar\b/gi, 'Market')
    .replace(/\bStesen\b/gi, 'Station')
    .replace(/\bMenara\b/gi, 'Tower')
    .replace(/\bBandar\b/gi, 'Town')
    .replace(/\bTaman\b/gi, 'Garden')
    .replace(/\bWilayah Persekutuan Kuala Lumpur\b/gi, 'Federal Territory of Kuala Lumpur');
}

/**
 * Normalizes location names to their recognized English equivalent.
 */
export function toEnglishPlaceName(name) {
  if (!name) return '';
  return name
    .replace(/\bMuzium Negara\b/gi, 'National Museum of Malaysia')
    .replace(/\bPasar Seni\b/gi, 'Central Market')
    .replace(/\bPasar Imbi\b/gi, 'Imbi Market')
    .replace(/\bGaleri Petronas\b/gi, 'Petronas Art Gallery')
    .replace(/\bRestoran\b/gi, 'Restaurant')
    .replace(/\bHospital Kuala Lumpur\b/gi, 'Kuala Lumpur General Hospital')
    .replace(/\bUniversiti Kuala Lumpur\b/gi, 'University of Kuala Lumpur')
    .replace(/\bPusat Tuisyen\b/gi, 'Tuition Centre')
    .replace(/\bKompleks\b/gi, 'Complex')
    .replace(/\bStesen\b/gi, 'Station');
}

export async function searchPlace(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const local = parseCoordinates(q) || findRailStation(q);
  if (local) return local;

  const url = `${NOMINATIM_URL}?format=json&limit=1&accept-language=en&q=${encodeURIComponent(q)}`;
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

  const rawName = first.name || first.display_name.split(',')[0];

  return {
    name: toEnglishPlaceName(first.display_name),
    shortName: toEnglishPlaceName(rawName),
    address: toEnglishAddress(first.display_name),
    lat,
    lon,
    coords: [lon, lat],
    type: first.type || 'Location',
  };
}

export async function reverseGeocode(lng, lat, mapboxApiKey = '') {
  // 1. Mapbox Geocoding API (Language English)
  if (mapboxApiKey) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxApiKey}&types=address,poi,neighborhood,locality&language=en`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const feat = data.features[0];
          const rawName = feat.text || feat.place_name?.split(',')[0] || `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          const rawAddr = feat.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}, Kuala Lumpur`;
          return {
            name: toEnglishPlaceName(rawName),
            address: toEnglishAddress(rawAddr),
            coords: [lng, lat],
          };
        }
      }
    } catch (err) {
      console.warn('Mapbox reverse geocoding warning:', err);
    }
  }

  // 2. OpenStreetMap Nominatim reverse in English
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SimeDarbyGIS/1.0',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const rawName = data.name || data.display_name.split(',')[0];
        return {
          name: toEnglishPlaceName(rawName),
          address: toEnglishAddress(data.display_name),
          coords: [lng, lat],
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocoding warning:', err);
  }

  return {
    name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}, Kuala Lumpur, Malaysia`,
    coords: [lng, lat],
  };
}
