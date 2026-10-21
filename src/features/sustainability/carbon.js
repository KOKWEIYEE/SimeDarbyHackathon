import dataset from './factors.json' with { type: 'json' };
import malaysiaGrid from './malaysia-grid.json' with { type: 'json' };
export { dataset };
export { malaysiaGrid };

export function electricCarbon(route, kWhPer100km, occupants, region='peninsular') {
  const unavailable=reason=>({status:'unavailable',kg:null,reason});
  if(route.status!=='available'||!Number.isFinite(route.distance)||route.distance<0) return unavailable('Driving route unavailable.');
  if(!Number.isFinite(kWhPer100km)||kWhPer100km<=0||!Number.isInteger(occupants)||occupants<1)
    return unavailable('Enter charging electricity per 100 km (including charging losses) and whole-number occupants.');
  const grid=malaysiaGrid.regions[region];
  if(!grid)return unavailable('Select a Malaysian charging grid.');
  const kWh=route.distance/1000*kWhPer100km/100;
  return {status:'available',kg:kWh*grid.value/occupants,kWh,breakdown:[],factor:grid.value,
    source:malaysiaGrid.source,year:malaysiaGrid.year,region:grid.name,
    reason:`Malaysia electricity scenario: ${grid.name}, 2024 provisional grid factor. User-supplied energy use; excludes lifecycle and grid losses.`};
}
const mapping = {BUS:'bus',INTERCITY_BUS:'bus',SUBWAY:'metro',METRO_RAIL:'metro',MONORAIL:'lightRail',TRAM:'lightRail',LIGHT_RAIL:'lightRail',HEAVY_RAIL:'rail',COMMUTER_TRAIN:'rail'};

export function extractSegments(item) {
  return (item.legs || []).flatMap(leg => leg.steps || []).map(step => ({
    mode:step.travelMode || 'UNKNOWN', metres:step.distanceMeters ?? null,
    vehicle:step.transitDetails?.transitLine?.vehicle?.type || null,
    line:step.transitDetails?.transitLine?.name || step.transitDetails?.transitLine?.nameShort || '',
  }));
}

export function operationalCarbon(route, fuel, occupants, enabled) {
  const unavailable = reason => ({status:'unavailable',kg:null,reason});
  if(route.status !== 'available') return unavailable('Route unavailable.');
  if(!Number.isFinite(route.distance)||route.distance<0) return unavailable('Route distance missing.');
  if(!enabled) return unavailable('Enable the UK reference scenario to calculate; these are not measured Malaysian emissions.');
  if(['walking','cycling'].includes(route.mode)) return {status:'available',kg:0,breakdown:[],reason:'Human-powered travel: no vehicle operational emissions. Food and lifecycle impacts excluded.'};
  if(route.mode === 'driving') {
    if(!Number.isFinite(fuel)||fuel<=0||!Number.isInteger(occupants)||occupants<1) return unavailable('Enter positive fuel consumption and whole-number occupants.');
    const litres=route.distance/1000*fuel/100;
    return {status:'available',kg:litres*dataset.factors.petrol.value/occupants,litres,breakdown:[],reason:'Mineral petrol reference factor; actual fuel blend and driving conditions may differ.'};
  }
  if(route.mode !== 'transit'||!route.segments?.length) return unavailable('Transit segment data missing.');
  const breakdown=[];
  for(const segment of route.segments) {
    if(segment.mode==='WALK') continue;
    const factorKey=segment.mode==='TRANSIT'?mapping[segment.vehicle]:null;
    if(!factorKey) return unavailable(`No compatible factor for ${segment.vehicle || segment.mode}; partial totals are not presented as complete.`);
    if(!Number.isFinite(segment.metres)||segment.metres<0) return unavailable('A transit segment has no valid distance.');
    const factor=dataset.factors[factorKey];
    breakdown.push({...segment,factorKey,factor:factor.value,factorLabel:factor.label,kg:segment.metres/1000*factor.value});
  }
  return {status:'available',kg:breakdown.reduce((n,s)=>n+s.kg,0),breakdown,
    reason:'UK average occupancy and energy factors used as proxies; passenger-km factors are not divided by car occupancy. Walking segments contribute zero vehicle emissions.'};
}
