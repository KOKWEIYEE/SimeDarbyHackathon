import { COMPLEX_FILTERS, buildComplex, floorKey, floorFromText } from './complexesService.js';

export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function fetchOverpass(query) {
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`Overpass error ${res.status}`);
      const data = await res.json();
      if (data.remark && /timed out|out of memory/i.test(data.remark)) {
        throw new Error(data.remark);
      }
      return data.elements || [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass fetch failed');
}

export function fromOverpass(elements, selectedCategories) {
  const complexes = elements
    .filter((el) => el.geometry || el.bounds)
    .map(buildComplex)
    .filter(Boolean);

  const seen = new Set();
  const pois = [];

  for (const el of elements) {
    if (el.geometry || el.bounds) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    const tags = el.tags || {};
    const cat = selectedCategories.find((c) =>
      c.filters?.some(([k, vals]) => vals.includes(tags[k]))
    );
    if (!cat) continue;

    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const floor =
      floorKey(tags) ??
      floorFromText(
        [tags['addr:unit'], tags['addr:housename'], tags['addr:flats']]
          .filter(Boolean)
          .join(', ')
      );

    pois.push({
      id: key,
      key,
      lat,
      lon,
      coords: [lon, lat],
      cat,
      categoryId: cat.id,
      name: tags.name || `Unnamed ${cat.label.toLowerCase()}`,
      unnamed: !tags.name,
      floor,
      cuisine: tags.cuisine || null,
      address: tags['addr:street']
        ? [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ')
        : null,
    });
  }

  return { pois, complexes, source: 'OpenStreetMap' };
}

export function buildOverpassQuery(selectedCategories, southWest, northEast) {
  const bbox = `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`;
  const poiParts = selectedCategories.flatMap((c) =>
    (c.filters || []).map(([key, values]) => `  nwr["${key}"~"^(${values.join('|')})$"](${bbox});`)
  );
  const complexParts = COMPLEX_FILTERS.map((f) => `  wr${f}(${bbox});`);

  return `[out:json][timeout:45];\n(\n${poiParts.join('\n')}\n)->.p;\n(\n${complexParts.join('\n')}\n)->.c;\n.p out center tags;\n.c out geom tags;`;
}
