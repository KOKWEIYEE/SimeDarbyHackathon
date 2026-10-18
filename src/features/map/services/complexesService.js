// Ways/relations treated as malls or buildings that can contain places.
export const COMPLEX_FILTERS = [
  '["shop"="mall"]',
  '["building"~"^(retail|commercial)$"]["name"]',
  '["aeroway"="terminal"]',
  '["landuse"="retail"]["name"]',
];

export function polygonContains(rings, lng, lat) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside; // even-odd over outer ring + holes
}

export function geometryContains(geometry, lng, lat) {
  if (!geometry) return false;
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polys.some((rings) => polygonContains(rings, lng, lat));
}

export function complexRings(el) {
  const toRing = (g) => g.map((p) => [p.lon, p.lat]);
  if (el.geometry) return [toRing(el.geometry)];
  const isClosed = (r) => r.length > 3 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];
  const rings = (el.members || [])
    .filter((m) => m.type === 'way' && m.geometry && (m.role === 'outer' || m.role === 'inner'))
    .map((m) => toRing(m.geometry))
    .filter(isClosed);
  if (rings.length) return rings;
  const b = el.bounds;
  return b ? [[[b.minlon, b.minlat], [b.maxlon, b.minlat], [b.maxlon, b.maxlat], [b.minlon, b.maxlat]]] : [];
}

export function makeComplex({ key, name, isMall, rings }) {
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const [x, y] of rings.flat()) {
    minLat = Math.min(minLat, y);
    maxLat = Math.max(maxLat, y);
    minLng = Math.min(minLng, x);
    maxLng = Math.max(maxLng, x);
  }
  return {
    keys: new Set([key]),
    name: name || 'Unnamed complex',
    isMall,
    parts: [rings],
    bounds: {
      minLat, minLng, maxLat, maxLng,
      getCenter: () => ({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }),
      contains: ([lat, lng]) => lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng,
    },
    area: (maxLat - minLat) * (maxLng - minLng),
    items: [],
  };
}

// Strips entrance/gate/parking suffixes so "Mall North Entrance" and "Mall" compare equal.
export function baseName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s[-\u2013\u2014|:,@].*$/, '')
    .replace(/\b(?:(?:north|south|east|west|northeast|northwest|southeast|southwest|main|upper|lower)\s+)*(?:entrance|entry|gate|door|doors|parking|garage|lot|exit)\b.*$/, '')
    .replace(/\s+(?:north|south|east|west|ne|nw|se|sw)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// One mall/building mapped several times becomes a single complex.
export function mergeComplexes(complexes) {
  const out = [];
  const groups = new Map();
  for (const cx of complexes) {
    const base = baseName(cx.name);
    if (base.length < 4 || cx.name === 'Unnamed complex') {
      out.push(cx);
      continue;
    }
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(cx);
  }
  for (const list of groups.values()) {
    const clusters = [];
    for (const cx of list) {
      const c1 = cx.bounds.getCenter();
      const near = clusters.find((cl) => {
        const c2 = cl.bounds.getCenter();
        return approxDistanceMeters(c1.lat, c1.lng, c2.lat, c2.lng) <= 2000;
      });
      if (!near) {
        clusters.push(cx);
        continue;
      }
      cx.keys.forEach((k) => near.keys.add(k));
      near.parts.push(...cx.parts);
      near.bounds.minLat = Math.min(near.bounds.minLat, cx.bounds.minLat);
      near.bounds.minLng = Math.min(near.bounds.minLng, cx.bounds.minLng);
      near.bounds.maxLat = Math.max(near.bounds.maxLat, cx.bounds.maxLat);
      near.bounds.maxLng = Math.max(near.bounds.maxLng, cx.bounds.maxLng);
      near.area += cx.area;
      near.isMall = near.isMall || cx.isMall;
      if (cx.name.length < near.name.length) near.name = cx.name;
    }
    out.push(...clusters);
  }
  return out;
}

export function buildComplex(el) {
  const rings = complexRings(el);
  if (!rings.length) return null;
  const tags = el.tags || {};
  return makeComplex({ key: `${el.type}/${el.id}`, name: tags.name, isMall: tags.shop === 'mall', rings });
}

export function floorKey(tags) {
  const raw = tags.level ?? tags['addr:floor'] ?? tags['level:ref'];
  return raw == null ? null : String(raw).split(';')[0].trim();
}

export function floorFromText(text) {
  if (!text) return null;
  const t = String(text);

  // 1. Concourse: Concourse Floor, Concourse Level, CC
  if (/\b(?:concourse|cc)\b/i.test(t)) {
    return 'CC';
  }

  // 2. Lower Ground / Feast Floor: Level LG, LG Floor, Lower Ground, Feast Floor
  if (/\b(?:lower\s*ground|lg\d*|feast\s*floor)\b/i.test(t)) {
    const lgMatch = t.match(/\blg\s*(\d+)\b/i);
    return lgMatch ? `-lg${lgMatch[1]}` : 'LG';
  }

  // 3. Upper Ground: Level UG, UG Floor, Upper Ground
  if (/\b(?:upper\s*ground|ug\d*)\b/i.test(t)) {
    return 'UG';
  }

  // 4. Ground: Level G, Ground Floor, G Floor, Lot G
  if (/\b(?:ground|main)\s*(?:floor|level)?\b/i.test(t) || /\b(?:level|lvl)\.?\s*g\b/i.test(t) || /\blot\s+g\b/i.test(t)) {
    return '0';
  }

  // 5. Basement: B1, B2, B3, Basement 1, Basement B2, Basement
  const bMatch = t.match(/\b(?:basement\s*(?:b)?|b)(\d+)\b/i) || t.match(/\bbasement\b/i);
  if (bMatch) {
    const num = bMatch[1] || '1';
    return `-${num}`;
  }

  // 6. Level / Floor with number: Level 1, Level 2, 3rd Floor, L4, Level 11, etc.
  let m = t.match(/\b(?:level|floor|lvl|fl|l)\.?\s*#?\s*(-?\d{1,2})(?:st|nd|rd|th)?\b/i) ||
          t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:floor|level|fl)\b/i);
  if (m) return m[1];

  // 7. Unit codes: L2-01, Lot 3.02, #04-12, G-15, LG-20
  m = t.match(/\b(?:l|lot|unit|#)\.?\s*([0-9]{1,2})[-.][0-9]{2,}\b/i);
  if (m) return m[1];

  // 8. 3-4 digit suite numbers (e.g. #302 => floor 3)
  m = t.match(/(?:^|[\s,(])(?:suite|ste|unit|space|spc|shop|store|room|rm|#)\.?\s*#?\s*[a-z]{0,2}-?(\d{3,4})\b/i);
  if (m) {
    const n = Math.floor(Number(m[1]) / 100);
    return n <= 40 ? String(n) : null;
  }

  return null;
}

export function floorLabel(key) {
  if (key == null || key === 'unknown' || key === '') return 'Ground & Retail Directory';
  const str = String(key).trim();
  const lower = str.toLowerCase();

  if (lower === '0' || lower === 'g' || lower === 'ground') return 'Ground Floor';
  if (lower === 'ug' || lower === 'upper ground') return 'Upper Ground (UG)';
  if (lower === 'lg' || lower === 'lower ground') return 'Lower Ground (LG)';
  if (lower === 'cc' || lower === 'concourse') return 'Concourse Level (CC)';
  if (lower.startsWith('-lg')) return `Lower Ground ${lower.replace('-lg', '')} (LG)`;
  if (/^-\d+$/.test(str)) return `Basement ${str.slice(1)}`;
  if (/^b\d+$/i.test(str)) return `Basement ${str.slice(1)}`;

  const n = Number(str);
  if (Number.isFinite(n)) {
    if (n === 0) return 'Ground Floor';
    if (n < 0) return `Basement ${-n}`;
    return `Level ${n}`;
  }

  return `Level ${str}`;
}

export function floorOrder(key) {
  if (key == null || key === 'unknown') return 0.1;
  const str = String(key).trim().toLowerCase();

  if (str === 'cc') return -0.4;
  if (str === 'lg') return -0.8;
  if (str.startsWith('-lg')) return -1.5;
  if (str === '0' || str === 'g') return 0;
  if (str === 'ug') return 0.5;

  if (str.startsWith('-')) {
    const n = Number(str.slice(1));
    return Number.isFinite(n) ? -1 - n : -1;
  }
  if (str.startsWith('b')) {
    const n = Number(str.slice(1));
    return Number.isFinite(n) ? -1 - n : -1;
  }

  const n = Number(str);
  return Number.isFinite(n) ? n : 100;
}
