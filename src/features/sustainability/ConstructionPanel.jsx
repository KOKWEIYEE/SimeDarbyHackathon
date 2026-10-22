import { useEffect, useRef, useState } from 'react';
import { constructionEstimate } from './construction.js';
import { getRoute } from './model.js';
import { getMapboxToken } from '../map/index.js';
import { presetPlans, concreteSource } from './walkway-presets.js';

const material = name => ({ name, quantity: '', factor: '', rate: '', source: '' });
const initial = () => [material('Paving / concrete'), material('Sub-base')];
export default function ConstructionPanel(props) {
  const [mode, setMode] = useState('auto');
  const [copied, setCopied] = useState(null);
  function copyToManual(data) { setCopied({ ...structuredClone(data), version: (copied?.version || 0) + 1 }); setMode('manual'); }
  return <section><nav aria-label="Construction calculation mode">
    <button aria-pressed={mode === 'auto'} onClick={() => setMode('auto')}>Automatic estimate</button>
    <button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Manual comparison</button>
  </nav>
    <div hidden={mode !== 'auto'}><ConstructionCalculator {...props} automatic={true} onCopy={copyToManual}/></div>
    <div hidden={mode !== 'manual'}><ConstructionCalculator {...props} automatic={false} key={copied?.version || 0} seed={copied}/></div>
  </section>;
}

function ConstructionCalculator({ origin, destination, walkingRoute, automatic, seed, onCopy, onShowRoute }) {
  const [type, setType] = useState(seed?.type || 'sidewalk');
  const [length, setLength] = useState(seed?.length || '');
  const [width, setWidth] = useState(seed?.width || (automatic ? '2' : ''));
  const [thickness, setThickness] = useState(automatic ? '0.1' : '');
  const [rates, setRates] = useState([{}, {}]);
  const [options, setOptions] = useState(seed?.options || [initial(), initial()]);
  const [localRoute, setLocalRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const route = localRoute?.status === 'available' ? localRoute : walkingRoute;
  const candidates = (route?.walkingSteps || []).map((step, index) => ({ ...step, index })).sort((a, b) => b.distance - a.distance).slice(0, 5);
  async function useRoute() {
    if (route?.status === 'available') { setLength(String(route.distance)); setSelected(null); onShowRoute?.(route.geometry); return; }
    if (!destination) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    setBusy(true);
    try {
      const mapboxToken = await getMapboxToken();
      const result = await getRoute('walking', origin.coords, destination.coords, { mapbox: mapboxToken }, controller.signal);
      if (request.current === controller) {
        setLocalRoute(result);
        if (result.status === 'available') { setLength(String(result.distance)); setSelected(null); onShowRoute?.(result.geometry); }
      }
    } finally { clearTimeout(timeout); if (request.current === controller) setBusy(false); }
  }
  const generated = presetPlans(length, width, thickness, type === 'covered');
  const displayedOptions = automatic ? (generated || [[material('Concrete surface')], [material('Concrete surface')]]).map((rows, option) => rows.filter(row => !generated || row.preset === 'concrete-surface').map((row, index) => ({ ...row, rate: rates[option][index] ?? row.rate }))) : options;
  const results = displayedOptions.map(rows => constructionEstimate({ length, width, rows }));
  const surfaceResults = results.map(result => result.items.find(item => item.preset === 'concrete-surface'));
  const surfaceReady = automatic && surfaceResults.every(item => item && item.carbon !== null);
  function change(option, row, key, value) {
    setOptions(previous => previous.map((rows, i) => i === option ? rows.map((item, j) => j === row ? { ...item, [key]: value } : item) : rows));
  }
  function selectType(value) {
    setType(value);
    setOptions(previous => previous.map(rows => value === 'covered' ? [...rows, { ...material('Roof'), cover: true }, { ...material('Supports and foundations'), cover: true }] : rows.filter(r => !r.cover)));
  }
  function exportReport() {
    const report = { origin, destination, type, automatic, thicknessMetres: automatic ? thickness : null, assumptions: automatic ? 'Default width 2 m and slab thickness 0.1 m are editable scenario assumptions, not measured or design standards.' : 'Manual quantities, factors and prices entered by user; dimensions do not populate material quantities.', lengthMetres: length, widthMetres: width, selectedSegment: selected, screening: { basis: 'Longest routing steps first for desktop review; not construction suitability', candidates, source: route?.source, retrieved: route?.retrieved }, results, createdAt: new Date().toISOString(), scope: automatic ? 'Concrete surface only; excludes sub-base, reinforcement, roof, supports, foundations and installation' : 'User-listed materials only', boundary: 'Material quantities only; incomplete items keep the whole-project total unavailable. Match factor units and lifecycle boundaries across both options.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `walkway-${automatic ? 'automatic' : 'manual'}-options.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="construction-panel"><h3>{automatic ? 'Concrete surface estimate' : 'Manual construction comparison'}</h3>
    <p>Compare two material specifications for the same proposed improvement.</p>
    <small>Map routes do not establish whether a sidewalk or shelter is missing. This proposal is for desktop comparison; construction suitability is unverified.</small>
    {!automatic && <div className="construction-improvement"><span>Improvement</span><div className="improvement-options" role="group" aria-label="Improvement type"><button type="button" aria-pressed={type === 'sidewalk'} onClick={() => selectType('sidewalk')}>Sidewalk</button><button type="button" aria-pressed={type === 'covered'} onClick={() => selectType('covered')}>Raincover</button></div></div>}
    {automatic && <p>Scope: concrete surface only. Excludes sub-base, reinforcement, rain cover, supports, foundations and installation.</p>}
    <label>Proposed length (m)<input type="number" min="0.1" step="any" value={length} onChange={e => { setLength(e.target.value); setSelected(null); }}/></label>
    <button disabled={!destination || busy} onClick={useRoute}>{busy ? 'Fetching walking route...' : 'Use walking route length'}</button>
    {!destination && <small>Select a destination above first.</small>}
    {localRoute?.status === 'unavailable' && <p role="status">{localRoute.reason}</p>}
    <small>Using the route length assumes improvements along the entire route. Edit it for a shorter section.</small>
    {candidates.length > 0 && <section className="road-review"><h3>Explore streets on this route</h3>
      <p>Longest walking steps first, to review where an improvement could cover more route length. This is not a suitability score or evidence that facilities are missing.</p>
      <button type="button" onClick={()=>onShowRoute?.(route.geometry)}>Show full walking route</button>
      {candidates.map(step => <article className={selected?.index===step.index ? "road-card selected" : "road-card"} key={step.index}><strong>{step.name} · {step.distance.toFixed(0)} m</strong><small>{step.instruction}</small><button onClick={() => { setSelected(step); setLength(String(step.distance)); onShowRoute?.(step.geometry); }}>Show street & compare plans</button></article>)}
      <small>Still unknown: existing shelter and sidewalks, crossings, slope, available width, drainage and land access. No segment is confirmed suitable for construction.</small>
      {selected && <p>Selected: {selected.name}. Both plans use this segment; update material quantities to match the scope.</p>}
    </section>}
    <label>Proposed width (m)<input type="number" min="0.1" step="0.1" value={width} onChange={e => setWidth(e.target.value)}/></label>
    {automatic && <><label>Concrete surface thickness (m)<input type="number" min="0.001" step="0.01" value={thickness} onChange={e => setThickness(e.target.value)}/></label>
    <small>Defaults: 2 m width and 0.10 m thickness are scenario assumptions, not measured dimensions or a construction specification.</small></>}
    {automatic ? <p>Concrete volume and carbon update automatically with length, width and thickness. Enter quoted unit prices below. Manual comparison has its own separate inputs.</p> : <p>Enter your own quantities, factors and prices, or edit plans explicitly copied from Auto. Dimensions are for context only and never fill quantities. Your manual entries are preserved when switching modes.</p>}
    <p>Plan area: {results[0].area === null ? 'Enter length and width' : `${results[0].area.toFixed(1)} m²`}</p>
    {surfaceReady && <article className="sustainability-result"><h3>Concrete surface comparison only</h3>
      <small>Carbon = quantity &times; factor. The default reduction is (336 &minus; 196) / 336 = 41.7%; it is a material-reference comparison, not a route suitability score.</small>
      <small>Volume = {length} m &times; {width} m &times; {thickness} m. Totals use unrounded volume; displayed numbers are rounded.</small>
      <p>{Number(surfaceResults[0].quantity).toFixed(2)} m³ per plan · A: {surfaceResults[0].carbon.toFixed(2)} kgCO2e · B: {surfaceResults[1].carbon.toFixed(2)} kgCO2e</p>
      <strong>{Math.abs(surfaceResults[0].carbon - surfaceResults[1].carbon).toFixed(2)} kgCO2e {surfaceResults[1].carbon <= surfaceResults[0].carbon ? 'less' : 'more'} for B{surfaceResults[0].carbon > 0 ? ` (${(Math.abs(surfaceResults[0].carbon - surfaceResults[1].carbon) / surfaceResults[0].carbon * 100).toFixed(1)}%)` : ''}</strong>
      <small>Excludes sub-base, reinforcement, roof, foundations and installation. This is not the whole-project reduction or a verified suitable mix.</small>
    </article>}
    {automatic && <details><summary>Automatic estimate sources and assumptions</summary><p>Volume = length × width × thickness. The source uses m³, so no guessed density or kg conversion is needed.</p><p><a href={concreteSource.url} target="_blank" rel="noreferrer">CSMA concrete reference</a>: RC32/40, 336 kgCO2e/m³ (Portland cement), 196 kgCO2e/m³ (50% GGBS). {concreteSource.region}. {concreteSource.boundary}</p><p>Local product availability, durability and design suitability are unverified. ICE Educational data is not embedded. Roof and foundation quantities need a structural specification.</p></details>}
    {!automatic && <><h3>How to compare lower-carbon materials</h3>
    <p>Fill Option A with your baseline specification, then copy it to B. In B, enter a sourced alternative material factor or revised material mass for the same function and service life. Lower mass or a lower factor reduces the material total; recycled content alone does not establish a saving.</p>
    <button onClick={() => setOptions(previous => [previous[0], previous[0].map(row => ({ ...row }))])}>Copy A to B (replaces B)</button></>}
    {displayedOptions.map((rows, option) => <fieldset key={option}><legend>{option === 0 ? 'Option A — baseline' : 'Option B — alternative'}</legend>
      {rows.map((row, index) => <details key={index}><summary>{row.name}</summary>
        <label>Material / specification<input disabled={automatic} value={row.name} onChange={e => change(option, index, 'name', e.target.value)}/></label>
        {!automatic && <label>Quantity unit<select value={row.unit || 'kg'} onChange={e => { change(option, index, 'unit', e.target.value); change(option, index, 'quantity', ''); change(option, index, 'factor', ''); change(option, index, 'rate', ''); change(option, index, 'source', ''); }}><option value="kg">kg</option><option value="m3">m3</option><option value="m2">m2</option></select><small>Changing units clears quantity, factor and price; no automatic conversion.</small></label>}
        {[['quantity', `Quantity (${row.unit || 'kg'})`], ['factor', `Material factor (kgCO2e / ${row.unit || 'kg'})`], ['rate', `Material price (RM / ${row.unit || 'kg'})`]].map(([key, label]) => <label key={key}>{label}<input disabled={automatic && key!=='rate'} type="number" min="0" step="any" value={row[key]} onChange={e => automatic ? setRates(previous => previous.map((prices, i) => i===option ? {...prices, [index]:e.target.value} : prices)) : change(option, index, key, e.target.value)}/></label>)}
        <label>Factor source, year and lifecycle boundary<input disabled={automatic} placeholder="EPD entry; e.g. A1–A3" value={row.source} onChange={e => change(option, index, 'source', e.target.value)}/></label>
        {rows.length > 1 && <p>Carbon: {results[option].items[index].carbon === null ? 'Enter quantity and factor' : `${results[option].items[index].carbon.toFixed(2)} kgCO2e`}</p>}
        {!row.source?.trim() && <small>Source missing: this is an unverified user assumption.</small>}
        {rows.length > 1 && <p>Cost: {results[option].items[index].cost === null ? 'Enter quantity and unit price' : `RM ${results[option].items[index].cost.toFixed(2)}`}</p>}
      </details>)}
      {!automatic && <button onClick={() => setOptions(previous => previous.map((items, i) => i === option ? [...items, material('Additional material')] : items))}>Add material</button>}
      <p>{automatic ? 'Concrete surface carbon' : 'Listed-material carbon'}: {results[option].missingCarbon === rows.length ? 'No carbon estimate yet. Enter quantity and factor.' : results[option].carbon === null ? `Incomplete: known-material subtotal ${results[option].carbonSubtotal.toFixed(2)} kgCO2e; ${results[option].missingCarbon} item(s) missing quantity or factor` : `${results[option].carbon.toFixed(2)} kgCO2e`}</p>
      <p>{automatic ? 'Concrete material cost' : 'Listed-material cost'}: {results[option].missingCost === rows.length ? 'No price estimate yet. Enter quantity and unit price.' : results[option].cost === null ? `Incomplete: priced-material subtotal RM ${results[option].costSubtotal.toFixed(2)}; ${results[option].missingCost} item(s) missing quantity or price` : `RM ${results[option].cost.toFixed(2)}`}</p>
    </fieldset>)}
    {!automatic && results.every(r => r.carbon !== null) && <p>Option B has {Math.abs(results[0].carbon - results[1].carbon).toFixed(2)} kgCO2e {results[1].carbon <= results[0].carbon ? 'less' : 'more'} material carbon than A. Compare only equivalent specifications and lifecycle boundaries.</p>}
    {!automatic && results.every(r => r.carbon !== null) && results[0].carbon > 0 && <strong>{(Math.abs(results[0].carbon - results[1].carbon) / results[0].carbon * 100).toFixed(1)}% {results[1].carbon <= results[0].carbon ? 'reduction' : 'increase'} compared with A</strong>}
    {!automatic && results.some(r => r.carbon === null) && <p>Whole-project savings pending: complete the missing material quantities and factors. {automatic ? 'Only the concrete surface is prefilled.' : 'Manual mode has no prefilled quantities or factors.'}</p>}
    <small>Material totals exclude labour, installation, transport and maintenance unless separately accounted for. Travel emissions savings are separate; no automatic carbon payback is claimed.</small>
    {automatic && <><button disabled={!surfaceReady} onClick={() => onCopy({ type, length, width, options: displayedOptions })}>Copy to Manual and edit (replaces manual plans)</button><small>Copies both concrete plans and prices only when clicked. Add other materials in Manual. Copied quantities stay fixed when dimensions change.</small></>}
    <button onClick={exportReport}>Export construction comparison</button>
  </section>;
}
