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
          const rawName = feat.text || feat.place_name?.split(',')[0] || 'Custom Pinned Location';
          const rawAddr = feat.place_name || 'Kuala Lumpur, Malaysia';
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
    name: 'Custom Pinned Location',
    address: 'Kuala Lumpur, Malaysia',
    coords: [lng, lat],
  };
}
