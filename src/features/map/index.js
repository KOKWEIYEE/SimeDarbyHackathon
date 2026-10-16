import mapboxgl from 'mapbox-gl';
import './styles.css';
export function initMapFeature({ apiKey, mapContainerRef, theme, onError, onPick }) {
 mapboxgl.accessToken = apiKey;
 const map = new mapboxgl.Map({ container: mapContainerRef.current, style: `mapbox://styles/mapbox/${theme === 'dark' ? 'dark' : 'light'}-v11`, center: [101.712, 3.155], zoom: 15.5, pitch: 60, bearing: -15, preserveDrawingBuffer: true });
 let mode = '3d', zone = null, visible = true, currentTheme = theme;
 let connection = null, activeRoute = null;
 const originMarker = new mapboxgl.Marker({ color: '#d27b35' });
 map.on('click', event => onPick?.(event.lngLat));
 function drawConnections() {
  if (!map.getSource('mapbox-dem')) return;
  const features = (connection?.routes || []).filter(r => r.status === 'available').map(r => ({ type:'Feature', properties:{ id:r.id }, geometry:r.geometry }));
  const data = { type:'FeatureCollection', features };
  if (map.getSource('walking-routes')) map.getSource('walking-routes').setData(data);
  else {
   map.addSource('walking-routes', { type:'geojson', data });
   map.addLayer({ id:'walking-routes', type:'line', source:'walking-routes', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':'#2497e3','line-width':4} });
   map.addSource('transit-stops', {type:'geojson',data:{type:'FeatureCollection',features:[]}});
   map.addLayer({id:'transit-stops',type:'circle',source:'transit-stops',paint:{'circle-color':'#2497e3','circle-radius':6,'circle-stroke-color':'#fff','circle-stroke-width':2}});
  }
  map.setPaintProperty('walking-routes','line-color',['case',['==',['get','id'],activeRoute || ''],'#187b59','#539ed0']);
  map.setPaintProperty('walking-routes','line-width',['case',['==',['get','id'],activeRoute || ''],6,3]);
  map.getSource('transit-stops').setData({type:'FeatureCollection',features:(connection?.routes || []).map(r => ({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[r.longitude,r.latitude]}}))});
 }
 map.addControl(new mapboxgl.NavigationControl(), 'top-right');
 map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
 map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
 function drawZone() {
  if (!map.getSource('mapbox-dem') || !zone) return;
  const ring = zone.coordinates.map(([lat, lng]) => [lng, lat]);
  const data = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } };
  if (map.getSource('analysis')) map.getSource('analysis').setData(data);
  else {
   map.addSource('analysis', { type: 'geojson', data });
   map.addLayer({ id: 'analysis-fill', type: 'fill', source: 'analysis', paint: { 'fill-color': '#36b890', 'fill-opacity': 0.25 } });
   map.addLayer({ id: 'analysis-line', type: 'line', source: 'analysis', paint: { 'line-color': '#36b890', 'line-width': 3 } });
  }
  ['analysis-fill', 'analysis-line'].forEach(id => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'));
 }
 map.on('style.load', () => {
  onError('');
  map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512 });
  if (map.getSource('composite')) map.addLayer({ id: 'buildings', source: 'composite', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 13, layout: { visibility: mode === '3d' ? 'visible' : 'none' }, paint: { 'fill-extrusion-color': '#8ba69e', 'fill-extrusion-height': ['coalesce', ['get', 'height'], 0], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.9 } });
  if (mode === '3d') map.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
  drawZone();
  drawConnections();
 });
 map.on('error', (event) => {
  const status = event.error?.status;
  if (status === 401) return onError('Mapbox rejected the token (401). Update VITE_MAPBOX_API_KEY and restart Vite.');
  if (status === 403) return onError('Mapbox denied this request (403). Check token permissions and allowed website URLs for your current browser address.');
  if (status === 429) return onError('Mapbox request limit reached (429). Check account usage and retry later.');
  if (event.sourceId === 'mapbox-dem') return onError('Terrain data could not load. The base map and 3D buildings may still be available.');
  // Avoid displaying request URLs: they may contain an access token.
  const message = String(event.error?.message || '');
  if (/webgl|context lost/i.test(message)) return onError('The browser lost its graphics context. Enable hardware acceleration and reload the page.');
  onError(status ? `A map resource failed to load (HTTP ${status}). Reload the page and check your network.` : 'A map resource failed to load. This may be a network or map-style error; the token is not necessarily invalid. Reload to retry.');
 });
 const observer = new ResizeObserver(() => map.resize());
 observer.observe(mapContainerRef.current);
 return {
  map,
  destroy() { observer.disconnect(); originMarker.remove(); map.remove(); },
  selectOrigin(lat, lon) { originMarker.setLngLat([lon,lat]).addTo(map); map.flyTo({center:[lon,lat],zoom:15}); },
  setConnectivity(next, selectedId) {
   connection = next; activeRoute = selectedId || next?.routes?.find(r=>r.status==='available')?.id;
   drawConnections();
   if (next) {
    const bounds = new mapboxgl.LngLatBounds([next.origin.longitude,next.origin.latitude],[next.origin.longitude,next.origin.latitude]);
    next.routes.filter(r=>r.status==='available' && (!selectedId || r.id===selectedId)).forEach(r=>r.geometry.coordinates.forEach(c=>bounds.extend(c)));
    map.fitBounds(bounds,{padding:65,maxZoom:16,pitch:mode==='3d'?60:0,duration:600});
   }
  },
  setTheme(next) { if (next === currentTheme) return; currentTheme = next; map.setStyle(`mapbox://styles/mapbox/${next === 'dark' ? 'dark' : 'light'}-v11`); },
  applyMapView(next) {
   mode = next;
   if (map.getSource('mapbox-dem')) map.setTerrain(next === '3d' ? { source: 'mapbox-dem', exaggeration: 1 } : null);
   if (map.getLayer('buildings')) map.setLayoutProperty('buildings', 'visibility', next === '3d' ? 'visible' : 'none');
   map.easeTo({ zoom: next === '3d' ? Math.max(map.getZoom(), 15.5) : map.getZoom(), pitch: next === '3d' ? 60 : 0, bearing: next === '3d' ? -15 : 0 });
  },
  setZone(next) { zone = next; drawZone(); if (next) { const bounds = new mapboxgl.LngLatBounds(); next.coordinates.forEach(([lat, lng]) => bounds.extend([lng, lat])); map.fitBounds(bounds, { padding: 70, maxZoom: 16, pitch: mode === '3d' ? 60 : 0, bearing: mode === '3d' ? -15 : 0, duration: 900 }); } },
  setVisible(next) { visible = next; drawZone(); },
  reset() { map.flyTo({ center: [101.712, 3.155], zoom: mode === '3d' ? 15.5 : 12.5, pitch: mode === '3d' ? 60 : 0, bearing: mode === '3d' ? -15 : 0 }); },
 };
}
