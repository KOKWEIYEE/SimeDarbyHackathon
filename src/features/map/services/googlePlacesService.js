import { makeComplex, floorFromText, geometryContains } from './complexesService.js';

export const DEFAULT_GOOGLE_API_KEY = 'AIzaSyDP18ON6QtVd1iVJ4Pj20QvJSmx9e8DBEQ';
export const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
export const GOOGLE_FIELDS =
  'places.id,places.displayName,places.location,places.types,places.primaryType,' +
  'places.formattedAddress,places.shortFormattedAddress,places.addressComponents,places.viewport';
export const GOOGLE_COMPLEX_TYPES = ['shopping_mall', 'airport', 'university', 'hospital', 'train_station', 'stadium'];
export const GOOGLE_MAX_REQUESTS = 60; // Caps requests; keeps search super fast and responsive
export const GOOGLE_MAX_TYPES = 45; // Places API allows at most 50 includedTypes per request
export const GOOGLE_MAX_DEPTH = 5;

export function cleanApiKey(key) {
  if (!key) return DEFAULT_GOOGLE_API_KEY;
  const cleaned = String(key).replace(/['";\s]/g, '').trim();
  return cleaned.length > 15 && !cleaned.startsWith('PASTE_') ? cleaned : DEFAULT_GOOGLE_API_KEY;
}

export function approxDistanceMeters(lat1, lon1, lat2, lon2) {
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

export class CellBounds {
  constructor(south, west, north, east) {
    this.south = Math.min(south, north);
    this.west = Math.min(west, east);
    this.north = Math.max(south, north);
    this.east = Math.max(west, east);
  }

  getSouth() { return this.south; }
  getWest() { return this.west; }
  getNorth() { return this.north; }
  getEast() { return this.east; }

  getCenter() {
    return {
      lat: (this.south + this.north) / 2,
      lng: (this.west + this.east) / 2,
      distanceTo: (pt) => approxDistanceMeters(
        (this.south + this.north) / 2,
        (this.west + this.east) / 2,
        pt.lat ?? pt[0],
        pt.lng ?? pt[1]
      ),
    };
  }

  getNorthWest() {
    return {
      lat: this.north,
      lng: this.west,
      distanceTo: (pt) => approxDistanceMeters(this.north, this.west, pt.lat ?? pt[0], pt.lng ?? pt[1]),
    };
  }

  getSouthEast() {
    return {
      lat: this.south,
      lng: this.east,
      distanceTo: (pt) => approxDistanceMeters(this.south, this.east, pt.lat ?? pt[0], pt.lng ?? pt[1]),
    };
  }

  getSouthWest() {
    return { lat: this.south, lng: this.west };
  }

  getNorthEast() {
    return { lat: this.north, lng: this.east };
  }

  contains(point) {
    const lat = Array.isArray(point) ? point[0] : (point.lat ?? point.latitude);
    const lng = Array.isArray(point) ? point[1] : (point.lng ?? point.longitude);
    return lat >= this.south && lat <= this.north && lng >= this.west && lng <= this.east;
  }
}

export function toCellBounds(b) {
  if (b instanceof CellBounds) return b;
  if (!b) return new CellBounds(3.1, 101.65, 3.2, 101.75);
  if (typeof b.getSouth === 'function') {
    return new CellBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
  }
  const south = b.south ?? b.minLat ?? (Array.isArray(b) ? b[0][1] : 3.1);
  const west = b.west ?? b.minLng ?? (Array.isArray(b) ? b[0][0] : 101.65);
  const north = b.north ?? b.maxLat ?? (Array.isArray(b) ? b[1][1] : 3.2);
  const east = b.east ?? b.maxLng ?? (Array.isArray(b) ? b[1][0] : 101.75);
  return new CellBounds(south, west, north, east);
}

export function subdivide(cell) {
  const c = cell.getCenter();
  const sw = cell.getSouthWest();
  const ne = cell.getNorthEast();
  return [
    new CellBounds(sw.lat, sw.lng, c.lat, c.lng),
    new CellBounds(sw.lat, c.lng, c.lat, ne.lng),
    new CellBounds(c.lat, sw.lng, ne.lat, c.lng),
    new CellBounds(c.lat, c.lng, ne.lat, ne.lng),
  ];
}

export function cellIntersects(cell, geometry) {
  if (!geometry) return true;
  const pts = [
    cell.getCenter(),
    cell.getNorthWest(),
    cell.getNorthEast(),
    cell.getSouthWest(),
    cell.getSouthEast(),
  ];
  if (pts.some((p) => geometryContains(geometry, p.lng, p.lat))) return true;
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polys.some((rings) =>
    rings.some((ring) => ring.some(([x, y]) => cell.contains([y, x])))
  );
}

export async function googleNearby(cell, types, apiKey) {
  const validKey = cleanApiKey(apiKey);
  const center = cell.getCenter();
  const radius = Math.max(1, cell.getNorthWest().distanceTo(cell.getSouthEast()) / 2);

  const res = await fetch(GOOGLE_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': validKey,
      'X-Goog-FieldMask': GOOGLE_FIELDS,
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: Math.min(radius, 50000),
        },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Google Places error ${res.status}`);
  return data.places || [];
}

export function googleFloor(place) {
  const comps = place.addressComponents || [];
  const fc = comps.find((c) => (c.types || []).includes('floor'));
  const fromComp = fc ? floorFromText(`floor ${fc.longText || fc.shortText}`) : null;
  if (fromComp != null) return fromComp;
  const unit = comps
    .filter((c) => (c.types || []).some((t) => t === 'subpremise' || t === 'room'))
    .map((c) => c.longText)
    .join(', ');
  return floorFromText([unit, place.formattedAddress, place.shortFormattedAddress].filter(Boolean).join(', '));
}

export async function googleCollect(rawBounds, isoGeometry, types, apiKey) {
  const bounds = toCellBounds(rawBounds);
  const found = new Map();
  const bad = new Set();

  const chunkList = () => {
    const ok = types.filter((t) => !bad.has(t));
    const out = [];
    for (let i = 0; i < ok.length; i += GOOGLE_MAX_TYPES) {
      out.push(ok.slice(i, i + GOOGLE_MAX_TYPES));
    }
    return out;
  };

  const callChunk = async (cell, list) => {
    try {
      return await googleNearby(cell, list, apiKey);
    } catch (err) {
      const rejected = list.filter((t) => new RegExp(`\\b${t}\\b`).test(err.message));
      if (!rejected.length) throw err;
      rejected.forEach((t) => bad.add(t));
      const rest = list.filter((t) => !bad.has(t));
      return rest.length ? googleNearby(cell, rest, apiKey) : [];
    }
  };

  const queryCell = async (cell) => {
    const res = await Promise.all(chunkList().map((list) => callChunk(cell, list)));
    return { places: res.flat(), saturated: res.some((r) => r.length >= 20) };
  };

  const tooBig = (c) => c.getNorthWest().distanceTo(c.getSouthEast()) / 2 > 50000;
  let cells = [bounds];
  while (cells.some(tooBig)) {
    cells = cells.flatMap((c) => (tooBig(c) ? subdivide(c) : [c]));
  }

  const queue = cells.filter((c) => cellIntersects(c, isoGeometry)).map((c) => [c, 0]);
  let requests = 0;
  let capped = false;

  while (queue.length) {
    const perCell = Math.max(1, chunkList().length);
    if (requests + perCell > GOOGLE_MAX_REQUESTS) {
      capped = true;
      break;
    }
    const batch = queue.splice(0, Math.min(6, Math.floor((GOOGLE_MAX_REQUESTS - requests) / perCell)));
    requests += batch.length * perCell;
    const results = await Promise.all(batch.map(([cell]) => queryCell(cell)));

    results.forEach(({ places, saturated }, i) => {
      for (const p of places) found.set(p.id, p);
      const [cell, depth] = batch[i];
      if (saturated && depth < GOOGLE_MAX_DEPTH) {
        for (const sub of subdivide(cell)) {
          if (cellIntersects(sub, isoGeometry)) queue.push([sub, depth + 1]);
        }
      }
    });
  }

  return { places: [...found.values()], requests, capped };
}

export async function loadFromGoogle(selected, bounds, isoGeometry, apiKey) {
  const validKey = cleanApiKey(apiKey);
  const types = [...new Set([...selected.flatMap((c) => c.google || []), ...GOOGLE_COMPLEX_TYPES])];
  const { places, requests, capped } = await googleCollect(bounds, isoGeometry, types, validKey);

  const complexes = [];
  const pois = [];

  for (const p of places) {
    const ptypes = p.types || [];
    const key = `g/${p.id}`;
    const name = p.displayName?.text;

    const v = p.viewport;
    if (v && ptypes.some((t) => GOOGLE_COMPLEX_TYPES.includes(t))) {
      const { low, high } = v;
      complexes.push(
        makeComplex({
          key,
          name,
          isMall: ptypes.includes('shopping_mall'),
          rings: [
            [
              [low.longitude, low.latitude],
              [high.longitude, low.latitude],
              [high.longitude, high.latitude],
              [low.longitude, high.latitude],
              [low.longitude, low.latitude],
            ],
          ],
        })
      );
    }

    const cat =
      selected.find((c) => c.google?.includes(p.primaryType)) ||
      selected.find((c) => c.google?.some((t) => ptypes.includes(t)));

    if (!cat || !p.location) continue;

    pois.push({
      key,
      lat: p.location.latitude,
      lon: p.location.longitude,
      coords: [p.location.longitude, p.location.latitude],
      cat,
      categoryId: cat.id,
      name: name || `Unnamed ${cat.label.toLowerCase()}`,
      unnamed: !name,
      floor: googleFloor(p),
      cuisine: null,
      address: p.shortFormattedAddress || p.formattedAddress || null,
    });
  }

  const source = `Google Places, ${requests} request${requests === 1 ? '' : 's'}${capped ? ' (request limit reached)' : ''}`;
  return { pois, complexes, source };
}
