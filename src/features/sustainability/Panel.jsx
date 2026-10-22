import { useEffect, useRef, useState } from 'react';
import { getRoute } from './model.js';
import { getMapboxToken } from '../map/index.js';
import { dataset, operationalCarbon, electricCarbon, malaysiaGrid } from './carbon.js';
import './styles.css';
import ConstructionPanel from './ConstructionPanel.jsx';

const labels={walking:'Walking',cycling:'Cycling (non-electric)',driving:'Petrol car',transit:'Public transport',electric:'Electric car (Malaysia grid)'};
export default function SustainabilityPanel({origin,destination,onPick,picking,onComparison}) {
  const [routes,setRoutes]=useState([]);
  const [section,setSection]=useState('journey');
  const [busy,setBusy]=useState(false);
  const [fuel,setFuel]=useState('');
  const [electricity,setElectricity]=useState('');
  const [gridRegion,setGridRegion]=useState('peninsular');
  const estimateRoute=r=>r.mode==='electric'?electricCarbon(r,Number(electricity),Number(occupants),gridRegion):operationalCarbon(r,Number(fuel),Number(occupants),true);
  const [occupants,setOccupants]=useState('1');
  const controller=useRef(null);
  useEffect(()=>{
    onComparison?.(routes.length?{origin:origin.coords,destination:destination?.coords,
      factorSelection:'Malaysia where available; UK fallback',source:dataset.source,boundary:dataset.boundary,region:'Mixed sources: Malaysian grid for electric car; UK references for petrol/transit',malaysiaGrid,electricityKWhPer100km:electricity,gridRegion,
      fuelLitresPer100km:fuel,occupants,units:'kgCO2e/person/one-way trip',
      results:routes.map(r=>({mode:r.mode,status:r.status,distance:r.distance,duration:r.duration,
        carbon:estimateRoute(r)}))}:null);
  },[routes,fuel,occupants,electricity,gridRegion,onComparison,origin.coords,destination?.coords]);
  useEffect(()=>{
    controller.current?.abort();controller.current=null;setRoutes([]);setBusy(false);
    return ()=>{controller.current?.abort();controller.current=null;};
  },[origin.coords[0],origin.coords[1],destination?.coords[0],destination?.coords[1]]);
  async function compare(){
    controller.current?.abort();
    const request=new AbortController();controller.current=request;
    const timeout=setTimeout(()=>request.abort(),25000);
    setBusy(true);setRoutes([]);
    const mapboxToken = await getMapboxToken();
    const keys = { mapbox: mapboxToken };
    try {
      const results=await Promise.all(Object.keys(labels).filter(mode=>mode!=='electric').map(mode=>getRoute(mode,origin.coords,destination.coords,keys,request.signal)));
      if(controller.current===request&&!request.signal.aborted)setRoutes([...results,{...results.find(r=>r.mode==='driving'),mode:'electric'}]);
      else if(controller.current===request)setRoutes([{mode:'driving',status:'unavailable',reason:'Route requests timed out. Please retry.'}]);
    } finally {clearTimeout(timeout);if(controller.current===request)setBusy(false);}
  }
  const car=routes.find(r=>r.mode==='driving'&&r.status==='available');
  const baseline=car?operationalCarbon(car,Number(fuel),Number(occupants),true).kg:null;
  function exportComparison(){
    const report={origin,destination,createdAt:new Date().toISOString(),scenario:'Mixed-source estimates: Malaysian electricity grid for electric car, UK reference factors for petrol/transit',malaysiaGrid,electricityKWhPer100km:electricity,gridRegion,factorSelection:'Malaysia where available; UK fallback',fuelLitresPer100km:fuel,occupants,units:'kgCO2e/person/one-way trip',dataset,routes:routes.map(r=>({...r,carbon:estimateRoute(r)}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='travel-carbon-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="sustainability-panel">
    <h2>Sustainability</h2>
    <nav aria-label="Sustainability tools"><button aria-pressed={section==='journey'} onClick={()=>setSection('journey')}>Journey comparison</button><button aria-pressed={section==='construction'} onClick={()=>setSection('construction')}>Sidewalk & rain cover</button></nav>
    <p>Compare one-way journeys to the same destination. Estimates are scenarios, not measured emissions savings.</p>
    <div className="sustainability-location"><strong>From</strong><span>{origin.name}</span>
      <small>Click the map normally to change the origin.</small>
      <strong>To</strong><span>{destination?.name||'Choose a destination'}</span>
      <button type="button" aria-pressed={picking} onClick={onPick}>{picking?'Cancel destination selection':'Pick destination on map'}</button>
      {picking&&<small role="status">Click the map to place your destination.</small>}
    </div>
    <div hidden={section!=='construction'}><ConstructionPanel key={`${origin.coords.join(',')}:${destination?.coords?.join(',')}`} origin={origin} destination={destination} walkingRoute={routes.find(r=>r.mode==='walking')}/></div>
    <div hidden={section!=='journey'}>
    <fieldset><legend>Petrol car assumptions</legend>
      <label>Fuel consumption (litres / 100 km)
        <input type="number" min="0.1" step="0.1" placeholder="Enter your vehicle's consumption" value={fuel} onChange={e=>setFuel(e.target.value)}/></label>
      <label>People sharing the car
        <input type="number" min="1" step="1" value={occupants} onChange={e=>setOccupants(e.target.value)}/></label>
      <small>One occupant is a starting assumption. Enter realistic fuel use; no fleet average is assumed. Diesel is not included. Occupancy also applies to the electric car scenario.</small>
    </fieldset>
    <fieldset><legend>Electric car - Malaysian electricity data</legend>
      <label>Charging electricity (kWh / 100 km, including charging losses)
        <input type="number" min="0.1" step="0.1" placeholder="Enter measured or sourced energy use" value={electricity} onChange={e=>setElectricity(e.target.value)}/></label>
      <label>Assumed charging region<select value={gridRegion} onChange={e=>setGridRegion(e.target.value)}>{Object.entries(malaysiaGrid.regions).map(([id,g])=><option key={id} value={id}>{g.name}</option>)}</select></label>
      <small>Official 2024 provisional factor: {malaysiaGrid.regions[gridRegion].value} kgCO2e/kWh. Uses the same driving route, not a charging-stop itinerary. KL defaults to the Peninsular grid.</small>
    </fieldset>
    <button className="run-analysis-btn" disabled={!destination||busy||picking} onClick={compare}>{busy?'Comparing routes…':'Compare journeys'}</button>
    <div aria-live="polite">{routes.map(route=>{
      const estimate=estimateRoute(route);
      const carbon=estimate.kg;
      return <article className="sustainability-result" key={route.mode}>
        <h3>{labels[route.mode]}</h3>
        {route.status==='available'?<>
          <p>{(route.distance/1000).toFixed(2)} km · {(route.duration/60).toFixed(0)} min estimated</p>
          <strong>{carbon===null?'Carbon estimate unavailable':`${carbon.toFixed(3)} kg CO2e / person / trip`}</strong>
          {route.mode==='electric'&&estimate.kWh!==undefined&&<p>Estimated charging electricity: {estimate.kWh.toFixed(2)} kWh for the whole car.</p>}
          {route.mode==='driving'&&estimate.litres!==undefined&&<p>Estimated petrol: {estimate.litres.toFixed(2)} L for the whole car.</p>}
          {route.mode!=='driving'&&carbon!==null&&baseline!==null&&<p>{Math.abs(baseline-carbon).toFixed(3)} kg CO2e {baseline>=carbon?'lower':'higher'} than the petrol car estimate.</p>}
          {carbon===null?<small>{estimate.reason}</small>:<details><summary>Calculation notes</summary><small>{estimate.reason}</small></details>}
          {estimate.breakdown?.length>0&&<details><summary>Transit segment calculations</summary><ol>{estimate.breakdown.map((s,i)=><li key={i}>{s.line||s.vehicle}: {(s.metres/1000).toFixed(2)} km * {s.factor} kgCO2e/passenger-km = {s.kg.toFixed(3)} kgCO2e. Proxy: {s.factorLabel}.</li>)}</ol></details>}
          <small>{route.source} · {route.retrieved}</small>
        </>:<p role="status">{route.reason}</p>}
      </article>;
    })}</div>
    {routes.length>0&&<button onClick={exportComparison}>Export comparison JSON</button>}
    <details><summary>Data sources and calculation basis</summary>
      <p>Malaysian factors are used where available: regional electricity for electric cars. Petrol and public transport currently use UK reference factors where suitable Malaysian factors have not been integrated. Walking and non-electric cycling have zero vehicle operational emissions.</p>
      <p>All results use operational kgCO2e per person per one-way trip. These are estimates, not full lifecycle footprints or measured mode-shift savings.</p>
      <p><a href={malaysiaGrid.source} target="_blank" rel="noreferrer">Malaysia Energy Commission grid factors</a>: {malaysiaGrid.year}, provisional; published {malaysiaGrid.published}. Original GgCO2e/GWh equals kgCO2e/kWh numerically.</p>
      <p>{malaysiaGrid.boundary}</p>
      <p>EV = driving km * charging kWh/100 km / 100 * regional grid factor / occupants. This is a scenario estimate, not a measured journey footprint. Local bus and rail passenger-km factors are still missing.</p>
      <p><a href={dataset.source} target="_blank" rel="noreferrer">UK DESNZ 2026 conversion factors</a> - Open Government Licence v3.0. Retrieved {dataset.retrieved}. These are UK reference values, not Malaysian reporting factors.</p>
      <p>{dataset.boundary}</p>
      <ul>{Object.values(dataset.factors).map(f=><li key={f.label}>{f.label}: {f.value} {f.unit} ({f.sheet}, {f.cell})</li>)}</ul>
      <p>Car = route km * litres/100 km / 100 * petrol factor / occupants. Transit = sum of each motorised segment's km * its passenger-km factor. Unsupported modes or missing transit distance leave the total unavailable. No annual savings or actual mode shift is assumed.</p>
      <p>Each mode uses its own route. Mapbox endpoints may snap up to 100 m; access to snapped points is excluded. Routes do not verify safe crossings or accessibility. Transit times depend on the departure time at request and are not a live arrival guarantee.</p>
      <p>Transit route metrics: Google Maps. Other route metrics: Mapbox / OpenStreetMap.</p>
    </details>
    </div>
  </section>;
}
