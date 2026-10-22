// EPA gasoline combustion factor, converted from kg / US gallon to kg / litre.
import { extractSegments } from './carbon.js';
import { getMapboxToken } from '../map/index.js';
// Tailpipe CO2 only: not CO2e, upstream energy, infrastructure or manufacturing.
export const PETROL_KG_CO2_PER_LITRE = 8.887 / 3.785411784;
export const FACTOR_SOURCE = 'https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle';

export function transitInstructions(item) {
  return (item.legs || []).flatMap(leg => leg.steps || []).map(step => {
    const transit = step.transitDetails;
    if (transit) {
      const line = transit.transitLine || {}, stops = transit.stopDetails || {};
      return `Take ${line.name || line.nameShort || 'public transport'}${transit.headsign ? ` towards ${transit.headsign}` : ''}: ${stops.departureStop?.name || 'boarding stop unavailable'} → ${stops.arrivalStop?.name || 'alighting stop unavailable'}${Number.isInteger(transit.stopCount) ? ` (${transit.stopCount} stops)` : ''}.`;
    }
    if (step.travelMode === 'WALK') return step.navigationInstruction?.instructions || (Number.isFinite(step.distanceMeters) ? `Walk ${step.distanceMeters} m.` : null);
    return null;
  }).filter(Boolean);
}

export function petrolEmissions(metres, litresPer100km, occupants) {
  if (![metres, litresPer100km, occupants].every(Number.isFinite) ||
      metres < 0 || litresPer100km <= 0 || occupants < 1 || !Number.isInteger(occupants)) return null;
  return metres / 1000 * litresPer100km / 100 * PETROL_KG_CO2_PER_LITRE / occupants;
}

export async function getRoute(mode, origin, destination, keys, signal) {
  const source = mode === 'transit' ? 'Google Routes' : 'Mapbox Directions';
  try {
    let route;
    if (mode === 'transit') {
      const point = coords => ({ location: { latLng: { latitude: coords[1], longitude: coords[0] } } });
      const response = await fetch('/api/routes/transit', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: point(origin), destination: point(destination), travelMode: 'TRANSIT' }),
      });
      if (!response.ok) throw new Error(`Google Routes HTTP ${response.status}: check API access, quota and key restrictions.`);
      const data = await response.json();
      const item = data.routes?.[0];
      if (item) route = {distance:item.distanceMeters, duration:Number(item.duration?.replace(/s$/, '')), instructions:transitInstructions(item), segments:extractSegments(item)};
    } else {
      const mapboxToken = keys?.mapbox || (await getMapboxToken());
      if (!mapboxToken) throw new Error('Mapbox key is not configured.');
      const query = new URLSearchParams({access_token:mapboxToken,overview:'full',geometries:'geojson',steps:'true',radiuses:'100;100'});
      const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${mode}/${origin.join(',')};${destination.join(',')}?${query}`,{signal});
      if (!response.ok) throw new Error(`Mapbox HTTP ${response.status}: check API access, quota and key restrictions.`);
      const data = await response.json();
      route = data.code === 'Ok' ? data.routes?.[0] : null;
    }
    if (!route) throw new Error('No route returned. This does not prove the connection is absent.');
    if (![route.distance,route.duration].every(v=>Number.isFinite(v)&&v>=0)) throw new Error('Route metrics are incomplete.');
    return {mode,source,status:'available',distance:route.distance,duration:route.duration,
      geometry:route.geometry,
      walkingSteps: mode === 'walking' ? route.legs?.flatMap(leg => leg.steps || []).filter(step => step.distance > 0).map(step => ({ name: step.name || 'Unnamed segment', distance: step.distance, geometry: step.geometry, instruction: step.maneuver?.instruction || '' })) : undefined,
      segments:route.segments,
      instructions:route.instructions || route.legs?.flatMap(leg=>leg.steps||[]).map(step=>step.maneuver?.instruction).filter(Boolean)||[],
      retrieved:new Date().toISOString()};
  } catch (error) {
    return {mode,source,status:'unavailable',reason:signal.aborted ? 'Request cancelled or timed out.' :
      error instanceof TypeError ? 'Network request failed.' : error.message};
  }
}
