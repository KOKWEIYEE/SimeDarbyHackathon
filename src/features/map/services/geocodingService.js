export const GEOCODING_URL = 'https://photon.komoot.io/api/';
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
export async function searchPlace(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const coordinates = parseCoordinates(q);
  if (coordinates) return coordinates;
  const station = findRailStation(q);
  if (station) return station;
  if (Date.now() - lastRequest < 1100) throw new Error('Please wait before searching again.');
  lastRequest = Date.now();
  const params = new URLSearchParams({q,limit:'5',lat:'3.139',lon:'101.6869',bbox:'99,0,120,8'});
  const response = await fetch(`${GEOCODING_URL}?${params}`, {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Search failed (${response.status}).`);
  const data = await response.json();
  const feature = data.features?.find(f=>f.properties?.countrycode?.toUpperCase()==='MY');
  if (!feature) return null;
  const [lon,lat] = feature.geometry.coordinates;
  if (![lon,lat].every(Number.isFinite)) throw new Error('Invalid coordinates.');
  const p=feature.properties;
  const name=[p.name,p.street,p.city,p.state,p.country].filter(Boolean).join(', ');
  return {name,shortName:p.name||name,lat,lon,coords:[lon,lat],type:p.osm_value||'Location'};
}
