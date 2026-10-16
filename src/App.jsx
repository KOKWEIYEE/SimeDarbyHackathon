import { useEffect, useRef, useState } from 'react';
import './features/ai/styles.css';
import { initMapFeature } from './features/map/index.js';
import { sites } from './features/ai/index.js';

const suggestions = [
 ['Check transit connections', 'Compare the available walking routes to nearby public transport. Which connection should we investigate first?'],
 ['Prioritise improvements', 'What evidence supports improving existing connections, checking crossings, or considering a shuttle? Do not assume we need a new walkway.'],
 ['Explore low-carbon materials', 'If an improvement is needed, what quantities and material carbon data should we collect to compare alternatives?'],
];
function download(text, name, type='application/json') {
 const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function App() {
 const mapContainerRef=useRef(null), mapFeature=useRef(null), scrollRef=useRef(null), busyRef=useRef(false), pickRef=useRef(false);
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('abso-theme')||'light';}catch{return 'light';}});
 const [mapMode,setMapMode]=useState('3d'), [mapError,setMapError]=useState(''), [picking,setPicking]=useState(false);
 const [collapsed,setCollapsed]=useState(false), [fullChat,setFullChat]=useState(false);
 const [origin,setOrigin]=useState({latitude:3.15175,longitude:101.71275,site_name:'KLCC example point'});
 const [draft,setDraft]=useState(''), [busy,setBusy]=useState(false), [messages,setMessages]=useState([]), [result,setResult]=useState(null), [activeId,setActiveId]=useState(null);
 const [material,setMaterial]=useState({quantity:'',baseline:'',proposed:'',source:''});
 const route=result?.routes.find(r=>r.id===activeId);
 const terrain=result?.terrain;
 const canCompare=material.source.trim() && material.quantity!=='' && material.baseline!=='' && material.proposed!=='' && Number(material.quantity)>0 && Number(material.baseline)>0 && Number(material.proposed)>=0 && [material.quantity,material.baseline,material.proposed].every(x=>Number.isFinite(Number(x)));
 function choose(lat,lon,name='Selected map point') {
  if(busyRef.current) return;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<3||lat>3.3||lon<101.55||lon>101.85){setMapError('Select a point within the KL pilot extent: latitude 3.0–3.3, longitude 101.55–101.85.');return;}
  setOrigin({latitude:lat,longitude:lon,site_name:name}); setResult(null);setActiveId(null);setMessages([]);setMapError('');
  mapFeature.current?.setConnectivity(null);mapFeature.current?.selectOrigin(lat,lon);
  pickRef.current=false;setPicking(false);
 }
 useEffect(()=>{
  const apiKey=(import.meta.env.VITE_MAPBOX_API_KEY||'').trim();
  if(!apiKey){setMapError('Add a Mapbox token to enable the map. You can enter coordinates below.');return;}
  try{mapFeature.current=initMapFeature({apiKey,mapContainerRef,theme,onError:setMapError,onPick:({lat,lng})=>{if(pickRef.current)choose(lat,lng);}});mapFeature.current.selectOrigin(origin.latitude,origin.longitude);}
  catch{setMapError('Map unavailable. Check browser graphics and your Mapbox configuration.');}
  return()=>{mapFeature.current?.destroy();mapFeature.current=null;};
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('abso-theme',theme);}catch{}mapFeature.current?.setTheme(theme);},[theme]);
 useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[messages,busy]);
 async function send(e){
  e?.preventDefault();if(!draft.trim()||busyRef.current)return;
  const lat=Number(origin.latitude),lon=Number(origin.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<3||lat>3.3||lon<101.55||lon>101.85){setMapError('Coordinates are outside the KL pilot extent.');return;}
  busyRef.current=true;setBusy(true);pickRef.current=false;setPicking(false);
  const question=draft.trim();setDraft('');setMessages(m=>[...m,{sender:'user',text:question}]);
  try{
   const response=await fetch('/api/connectivity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...origin,latitude:lat,longitude:lon,message:question}),signal:AbortSignal.timeout(65000)});
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(typeof data?.detail==='string'?data.detail:'Connectivity service unavailable. Check the Python backend.');
   if(!Array.isArray(data?.routes)||typeof data.response_text!=='string')throw new Error('Invalid analysis response. Please retry.');
   setResult(data);const id=data.routes.find(r=>r.status==='available')?.id||data.routes[0]?.id;setActiveId(id);mapFeature.current?.setConnectivity(data,id);
   setMessages(m=>[...m,{sender:'bot',text:data.response_text}]);
  }catch(error){setMessages(m=>[...m,{sender:'error',text:error.message}]);setDraft(question);}
  finally{busyRef.current=false;setBusy(false);}
 }
 function selectRoute(r){setActiveId(r.id);mapFeature.current?.setConnectivity(result,r.id);}
 async function exportResult(type){
  if(type==='json')return download(JSON.stringify(result,null,2),'abso-connectivity.json');
  if(type==='csv')return download('stop,route_status,walking_metres,estimated_minutes\n'+result.routes.map(r=>[r.name,r.status,r.distance_m??'',r.duration_minutes??''].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),'abso-routes.csv','text/csv');
  try{const map=mapFeature.current?.map;if(!map?.loaded())throw new Error('Wait for the map to load.');const data=map.getCanvas().toDataURL('image/png');
   if(type==='png'){const a=document.createElement('a');a.href=data;a.download='abso-connections.png';a.click();}
   else{if(!window.jspdf)throw new Error('PDF library unavailable.');const pdf=new window.jspdf.jsPDF('landscape');pdf.text('Abso | Public transport connectivity',12,14);pdf.addImage(data,'PNG',12,22,273,160);pdf.setFontSize(9);pdf.text('Mapbox / OpenStreetMap. Modelled routes; field verification required.',12,194);pdf.save('abso-connections.pdf');}
  }catch(error){setMapError(error.message);}
 }
 return <div className="workspace">
  <header className="app-header"><a className="brand" href="#"><span className="brand-mark">a</span><strong>abso<span className="brand-dot">.</span></strong></a><div className="project-heading"><span className="eyebrow">SIME DARBY PROPERTY / CONNECTIVITY LAB</span><span>Better connections, better places <span className="pilot">KL pilot</span></span></div><div className="header-actions"><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} aria-label="Toggle colour theme">{theme==='dark'?'☀ Light':'☾ Dark'}</button><details className="export-wrap"><summary>Export ↓</summary><div className="export-menu">{['png','pdf','csv','json'].map(type=><button key={type} disabled={['csv','json'].includes(type)&&!result} onClick={e=>{e.currentTarget.closest('details').open=false;exportResult(type);}}>{type.toUpperCase()}</button>)}</div></details></div></header>
  <main className={`main-layout ${collapsed?'collapsed':''} ${fullChat?'full-chat':''}`}>
   <aside className="ai-panel"><div className="panel-header"><strong>Connection analyst</strong><div className="panel-actions"><button aria-label="Expand assistant" onClick={()=>{setFullChat(v=>!v);setCollapsed(false);}}>↗</button><button aria-label="Toggle assistant" onClick={()=>{setCollapsed(v=>!v);setFullChat(false);}}>{collapsed?'+':'−'}</button></div></div>
   {!collapsed&&<><div className="panel-scroll" ref={scrollRef}>
    <section className="welcome-card"><span className="eyebrow">SITE → TRANSIT → BETTER CONNECTIONS</span><h1>Close to transit.<br/><em>But connected?</em></h1><p>Compare walking routes and terrain. Find what to check before deciding what to improve.</p></section>
    <div className="workflow-strip"><span>1 Select</span><span>2 Assess</span><span>3 Improve</span></div>
    <form id="planning-form" onSubmit={send}><fieldset disabled={busy}><legend>Start from your site</legend><label>Example location<select value="" onChange={e=>{const s=sites.find(s=>s.id===e.target.value);if(s)choose(s.coordinates.reduce((a,c)=>a+c[0],0)/s.coordinates.length,s.coordinates.reduce((a,c)=>a+c[1],0)/s.coordinates.length,s.name+' example point');}}><option value="">Choose a shortcut…</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <button className="pick-button" type="button" aria-pressed={picking} onClick={()=>{pickRef.current=!picking;setPicking(!picking);}}>{picking?'Click your site on the map…':'⌖ Pick a point on the map'}</button>
    <p className="helper">{origin.site_name} · {Number(origin.latitude).toFixed(5)}, {Number(origin.longitude).toFixed(5)}</p>
    <details className="coordinate-input"><summary>Enter coordinates instead</summary><div className="form-grid">{[['latitude','Latitude',3,3.3],['longitude','Longitude',101.55,101.85]].map(([k,label,min,max])=><label key={k}>{label}<input type="number" required step="any" min={min} max={max} value={origin[k]} onChange={e=>{setOrigin(o=>({...o,[k]:e.target.value,site_name:'Entered location'}));setResult(null);setMessages([]);mapFeature.current?.setConnectivity(null);}} onBlur={()=>{if(origin.latitude!==''&&origin.longitude!=='')choose(Number(origin.latitude),Number(origin.longitude),'Entered location');}}/></label>)}</div></details>
    <p className="helper">Choose a likely site entrance. Map points are study origins, not surveyed parcel boundaries.</p></fieldset></form>
    <div className="suggestions">{suggestions.map(([title,text],i)=><button key={title} disabled={busy} onClick={()=>setDraft(text)}><span className="suggestion-number">0{i+1}</span>{title}<span>↗</span></button>)}</div>
    <div className="message-list" role="log" aria-live="polite">{messages.map((m,i)=><article key={i} className={`message ${m.sender}`}><small>{m.sender==='user'?'YOU':m.sender==='error'?'REQUEST FAILED':'ABSO · EVIDENCE-BASED SCREENING'}</small><p>{m.text}</p></article>)}{busy&&<p className="loading">Checking routes, terrain and connection priorities…</p>}</div>
    {result&&<div className="action-plan"><h3>Priorities to investigate</h3><ol>{result.priorities.map((p,i)=><li key={i}>{p}</li>)}</ol><details><summary>Field checks still needed</summary><ul>{result.field_checks.map((p,i)=><li key={i}>{p}</li>)}</ul></details></div>}
    <details className="material-panel"><summary>Optional · compare material carbon</summary><p className="helper">After choosing an intervention, enter the same material quantity and comparable factors. No ICE data or default reduction is assumed.</p>{[['quantity','Material quantity (kg)'],['baseline','Baseline factor (kgCO₂e/kg)'],['proposed','Alternative factor (kgCO₂e/kg)'],['source','Factor source / EPD and lifecycle scope']].map(([k,label])=><label key={k}>{label}<input type={k==='source'?'text':'number'} min="0" step="any" value={material[k]} onChange={e=>setMaterial(m=>({...m,[k]:e.target.value}))}/></label>)}{canCompare&&<p className="material-result">Baseline: {(Number(material.quantity)*Number(material.baseline)).toFixed(1)} kgCO₂e<br/>Alternative: {(Number(material.quantity)*Number(material.proposed)).toFixed(1)} kgCO₂e<br/>Difference: {(Number(material.quantity)*(Number(material.baseline)-Number(material.proposed))).toFixed(1)} kgCO₂e (positive = reduction).<br/><small>User-supplied factors; confirm equivalent performance and lifecycle boundaries.</small></p>}</details>
   </div><div className="composer"><textarea form="planning-form" required maxLength={4000} aria-label="Connectivity question" placeholder="How can this site connect better to transit?" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();document.getElementById('planning-form').requestSubmit();}}}/><button form="planning-form" type="submit" disabled={busy||!draft.trim()} aria-label="Analyse connection">{busy?'…':'↑'}</button><small>AI screening · route evidence + explicit data gaps</small></div></>}
   </aside>
   <section className="map-workspace" aria-label="Transit connectivity map"><div className="map-toolbar"><div><span className="eyebrow">STUDY ORIGIN</span><strong>{result?.origin.name||origin.site_name}</strong></div><div className="map-actions"><button onClick={()=>mapFeature.current?.selectOrigin(Number(origin.latitude),Number(origin.longitude))}>⌖ Site</button><button aria-pressed={mapMode==='3d'} onClick={()=>{const next=mapMode==='3d'?'2d':'3d';setMapMode(next);mapFeature.current?.applyMapView(next);}}>{mapMode==='3d'?'2D view':'3D view'}</button></div></div>
   <div className={`map-stage ${picking?'picking':''}`}><div id="map" ref={mapContainerRef}/><div className="map-caption">{picking?'CLICK TO SELECT A STUDY ORIGIN':'KUALA LUMPUR · CONNECTION SCREENING'}</div>{mapError&&<div className="map-error" role="status">{mapError}<button aria-label="Dismiss message" onClick={()=>setMapError('')}>×</button></div>}<div className="map-legend"><span className="origin-dot"/> Study origin <span className="route-line"/> Walking route<br/><small>Modelled routes · verify entrances and crossings</small></div></div>
   <section className="insights"><div className="section-heading"><h2>{result?'Connection overview':'Select a site. Ask about its connections.'}</h2><span className="pilot">Preliminary screening</span></div>
   <div className="kpi-grid">{[
    ['Transit nearby',result?`${result.nearby_stop_records} records`:'—','Within 800 m straight-line'],
    ['Walking distance',route?.status==='available'?`${route.distance_m} m`:'—','Selected Mapbox route'],
    ['Estimated walk',route?.status==='available'?`${route.duration_minutes} min`:'—','Model estimate, not observed'],
    ['Terrain',terrain?.status==='available'?`${terrain.center_elevation_m} m`:'—',terrain?.status==='available'?`Sample range ${terrain.sample_min_m}–${terrain.sample_max_m} m`:'Coarse DEM, not route slope'],
    ['On-site conditions','Unverified','Sidewalks · crossings · barriers'],
   ].map(([label,value,note])=><article className="kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
   {result&&<><div className="route-options" aria-label="Candidate transit connections">{result.routes.length?result.routes.map(r=><button key={r.id} aria-pressed={activeId===r.id} onClick={()=>selectRoute(r)}><strong>{r.name}</strong><small>{r.feed==='rapid-rail-kl'?'Rail':'Bus'} · {r.status==='available'?`${r.duration_minutes} min / ${r.distance_m} m`:r.status==='no_route'?'No route returned':'Routing unavailable'}</small></button>):<p>No candidate stops within 2 km. Try another point; this is not proof that no transit exists.</p>}</div>{route?.reason&&<p className="context-note">{route.reason}</p>}<details className="evidence"><summary>Sources, snapping & limitations</summary><ul>{result.assumptions.map(a=><li key={a}>{a}</li>)}{terrain?.status==='available'?<li>Terrain: {terrain.source} · {terrain.datasets.join(', ')} · retrieved {terrain.retrieved_at_utc}</li>:<li>Terrain: {terrain?.reason}</li>}{route?.status==='available'&&<li>Mapbox route retrieved {route.retrieved_at_utc}. Origin/destination snapped offsets: {route.snapped_waypoints.map(w=>`${w.offset_m} m`).join(' / ')}.</li>}</ul></details></>}
   </section></section>
  </main>
 </div>;
}
