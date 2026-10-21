import { loadFromGoogle } from './googlePlacesService.js';
import { fetchOverpass, fromOverpass, buildOverpassQuery } from './overpassService.js';
import { mergeComplexes, geometryContains, polygonContains } from './complexesService.js';
import { PLACES_DATA, PRESET_LOCATIONS } from '../placesData.js';
import { ALL_CATEGORY_ITEMS } from '../categories.js';

function approxDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function hasGoogleKey(key) {
  return Boolean(key && !key.startsWith('PASTE_') && key.length > 10);
}

/**
 * Searches nearby places using Google Places (if key provided), Overpass, or local curated fallback.
 */
export async function searchNearbyPlaces({
  centerCoords, // [lng, lat]
  isoGeometry = null,
  selectedCategories = [],
  googleApiKey = '',
  maxMinutes = 20,
  bounds = null, // { south, west, north, east }
}) {
  const [centerLng, centerLat] = centerCoords;
  const selectedSet = new Set(selectedCategories.map((c) => (typeof c === 'string' ? c : c.id)));
  const catObjects = ALL_CATEGORY_ITEMS.filter((c) => selectedSet.has(c.id));

  // Determine cell bounds if not provided
  let searchBounds = bounds;
  if (!searchBounds) {
    const deltaLat = 0.045; // ~5km
    const deltaLng = 0.045;
    searchBounds = {
      south: centerLat - deltaLat,
      west: centerLng - deltaLng,
      north: centerLat + deltaLat,
      east: centerLng + deltaLng,
    };
  }

  let rawPlaces = [];
  let rawComplexes = [];
  let source = 'Curated GIS Data';

  // 1. Try Google Places API if valid key
  if (hasGoogleKey(googleApiKey)) {
    try {
      const gResult = await loadFromGoogle(catObjects, searchBounds, isoGeometry, googleApiKey);
      if (gResult.pois && gResult.pois.length > 0) {
        rawPlaces = gResult.pois;
        rawComplexes = gResult.complexes || [];
        source = gResult.source;
      }
    } catch (err) {
      console.warn('Google Places search failed, falling back:', err.message);
    }
  }

  // 2. Try OpenStreetMap Overpass if no Google Places results
  if (rawPlaces.length === 0 && catObjects.length > 0) {
    try {
      const query = buildOverpassQuery(
        catObjects,
        { lat: searchBounds.south, lng: searchBounds.west },
        { lat: searchBounds.north, lng: searchBounds.east }
      );
      const elements = await fetchOverpass(query);
      const osmResult = fromOverpass(elements, catObjects);
      if (osmResult.pois && osmResult.pois.length > 0) {
        rawPlaces = osmResult.pois;
        rawComplexes = osmResult.complexes || [];
        source = 'OpenStreetMap';
      }
    } catch (err) {
      console.warn('Overpass search failed, using curated dataset:', err.message);
    }
  }

  // 3. Fallback / Merge with curated local places
  const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
  const localCurated = PLACES_DATA.filter((p) => selectedSet.has(p.categoryId)).map((p) => {
    const cat = catMap.get(p.categoryId) || { id: p.categoryId, label: p.categoryId, color: '#2563eb' };
    return {
      id: p.id,
      key: p.id,
      name: p.name,
      coords: p.coords,
      lat: p.coords[1],
      lon: p.coords[0],
      categoryId: p.categoryId,
      cat,
      address: p.address,
      source: 'Local curated list (not live verified)',
      floor: p.floor || null,
      cuisine: p.cuisine || null,
    };
  });

  // Combine places without duplicates by coordinate proximity
  const allPlaces = [...rawPlaces];
  let addedLocal = false;
  for (const loc of localCurated) {
    if (loc.lat < searchBounds.south || loc.lat > searchBounds.north || loc.lon < searchBounds.west || loc.lon > searchBounds.east) continue;
    const exists = allPlaces.some(
      (p) => approxDistanceMeters(p.lat, p.lon, loc.lat, loc.lon) < 25
    );
    if (!exists) {
      allPlaces.push(loc);
      addedLocal = true;
    }
  }
  if (addedLocal) source = rawPlaces.length ? `${source} + local curated list (not live verified)` : 'Local curated list (not live verified)';

  // Filter against isochrone geometry if present
  let filteredPlaces = allPlaces;
  if (isoGeometry) {
    filteredPlaces = allPlaces.filter((p) => geometryContains(isoGeometry, p.lon, p.lat));
  }

  // Calculate distance from center for all places
  const items = filteredPlaces.map((place) => {
    const distMeters = approxDistanceMeters(centerLat, centerLng, place.lat, place.lon);
    return {
      ...place,
      distanceMeters: distMeters,
      distanceKm: (distMeters / 1000).toFixed(2),
    };
  });

  // Cluster into complexes/malls
  const complexes = mergeComplexes(rawComplexes);
  const ownerOf = new Map();
  for (const cx of complexes) {
    for (const k of cx.keys) ownerOf.set(k, cx);
  }

  const loose = [];
  for (const item of items) {
    let best = null;
    for (const cx of complexes) {
      if (cx.keys.has(item.key)) continue;
      const inside = cx.bounds.contains([item.lat, item.lon]) &&
        cx.parts.some((r) => polygonContains(r, item.lon, item.lat));
      const byAddress =
        !inside && item.address && cx.name.length >= 4 && item.address.toLowerCase().includes(cx.name.toLowerCase());
      if (!inside && !byAddress) continue;
      if (!best || cx.area < best.area) best = cx;
    }
    if (best) best.items.push(item);
    else loose.push(item);
  }

  return {
    places: items,
    loosePlaces: loose,
    complexes,
    source,
    totalCount: items.length,
  };
}
