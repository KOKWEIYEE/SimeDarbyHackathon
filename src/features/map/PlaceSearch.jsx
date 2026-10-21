import { useId, useState } from 'react';
import { searchPlace } from './services/geocodingService.js';

export default function PlaceSearch({onSelect, originOnly = false, selectionLabel}) {
  const queryId = useId();
  const [query,setQuery]=useState('');
  const [target,setTarget]=useState('origin');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState('');
  async function search(event){
    event.preventDefault();
    if(busy||!query.trim())return;
    setBusy(true);setError('');setResult(null);
    try {const place=await searchPlace(query);setResult(place);if(!place)setError('No match in Malaysia. Try a full name or address.');}
    catch(error) {setError(error.message || 'Place search unavailable. Please retry or pick a point on the map.');}
    finally {setBusy(false);}
  }
  return <div className="place-search">
    <form onSubmit={search}>
      <label htmlFor={queryId}>Search a place in Malaysia</label>
      <div className="place-search-row">
        <input id={queryId} disabled={busy} value={query} maxLength={200} placeholder="e.g. KL Sentral, Kuala Lumpur"
          onChange={e=>{setQuery(e.target.value);setResult(null);setError('');}}/>
        <button disabled={busy||!query.trim()}>{busy?'Searching...':'Search'}</button>
      </div>
      {!originOnly && <label>Use as <select value={target} onChange={e=>setTarget(e.target.value)}>
        <option value="origin">Starting point</option><option value="destination">Destination</option>
      </select></label>}
    </form>
    {error&&<p role="status">{error}</p>}
    {result&&<button className="place-search-result" onClick={()=>{onSelect(result,target);setResult(null);}}>
      {result.name}<small>Use this location as {selectionLabel || target}</small>{result.note&&<small>{result.note}</small>}
    </button>}
    <small>Search: Prasarana rail snapshot / OpenStreetMap contributors / Nominatim. Confirm the result before selecting.</small>
  </div>;
}

