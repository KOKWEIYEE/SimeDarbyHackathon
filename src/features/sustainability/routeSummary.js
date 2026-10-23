export function transitLineLabel(line = {}) {
  const short = line.nameShort || '';
  const name = line.name || '';
  const known = { KJL: 'LRT Kelana Jaya Line', AGL: 'LRT Ampang Line', SPL: 'LRT Sri Petaling Line', KGL: 'MRT Kajang Line', PYL: 'MRT Putrajaya Line', MRL: 'KL Monorail' };
  if (known[short.toUpperCase()]) return known[short.toUpperCase()];
  const label = name || short;
  if (/\b(MRT|LRT|monorail|bus|KTM)\b/i.test(label)) return label;
  const modes = { BUS:'Bus', INTERCITY_BUS:'Bus', SUBWAY:'Metro', METRO_RAIL:'Metro', LIGHT_RAIL:'Light rail', MONORAIL:'Monorail', HEAVY_RAIL:'Train', COMMUTER_TRAIN:'Commuter train', TRAM:'Tram', FERRY:'Ferry' };
  const mode = modes[line.vehicle?.type] || line.vehicle?.name?.text || 'Public transport';
  return label ? `${mode} ${label}` : mode;
}

// Keep boarding and transfer details, combining consecutive walking steps.
export function summarizeTransitSteps(route) {
  const summary = [];
  let walkingMetres = 0;
  const flushWalking = () => {
    if (walkingMetres > 0) summary.push(`Walk about ${Math.round(walkingMetres)} m.`);
    walkingMetres = 0;
  };
  for (const step of (route.legs || []).flatMap(leg => leg.steps || [])) {
    if (step.transitDetails) {
      flushWalking();
      const { transitLine = {}, stopDetails = {}, headsign } = step.transitDetails;
      summary.push(`Take ${transitLineLabel(transitLine)}${headsign ? ` towards ${headsign}` : ''}: ${stopDetails.departureStop?.name || 'boarding stop unavailable'} → ${stopDetails.arrivalStop?.name || 'alighting stop unavailable'}.`);
    } else if (step.travelMode === 'WALK' && Number.isFinite(step.distanceMeters)) {
      walkingMetres += step.distanceMeters;
    }
  }
  flushWalking();
  return summary;
}
