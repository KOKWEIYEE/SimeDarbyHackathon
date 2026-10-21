import { searchPlace } from '../map/services/geocodingService.js';
import { getRoute } from '../sustainability/model.js';

export async function resolveRouteAction(action, keys) {
  if(action?.type!=='route'||!['walking','cycling','driving','transit'].includes(action.mode))
    throw new Error('Unsupported map action.');
  const origin=await searchPlace(action.origin);
  if(!origin)throw new Error(`Could not find the starting point: ${action.origin}. Please give a fuller name or address.`);
  // Respect the public search service's request spacing.
  await new Promise(resolve=>setTimeout(resolve,1150));
  const destination=await searchPlace(action.destination);
  if(!destination)throw new Error(`Could not find the destination: ${action.destination}. Please give a fuller name or address.`);
  const route=await getRoute(action.mode,origin.coords,destination.coords,keys,AbortSignal.timeout(20000));
  return {origin,destination,route};
}
