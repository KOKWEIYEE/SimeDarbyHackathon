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
      summary.push(`Take ${transitLine.nameShort || transitLine.name || 'public transport'}${headsign ? ` towards ${headsign}` : ''}: ${stopDetails.departureStop?.name || 'boarding stop unavailable'} → ${stopDetails.arrivalStop?.name || 'alighting stop unavailable'}.`);
    } else if (step.travelMode === 'WALK' && Number.isFinite(step.distanceMeters)) {
      walkingMetres += step.distanceMeters;
    }
  }
  flushWalking();
  return summary;
}
