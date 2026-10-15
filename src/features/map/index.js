import mapboxgl from 'mapbox-gl';
import './styles.css';

export function initMapFeature({ apiKey, mapContainerRef, errorBoxRef, onModeChange }) {
  const container = mapContainerRef?.current;

  if (!container) {
    throw new Error('Map container ref is required.');
  }

  mapboxgl.accessToken = apiKey;

  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [101.7069, 3.139],
    zoom: 12.3,
    pitch: 0,
    bearing: 0,
    antialias: true,
    attributionControl: true,
  });

  let mapMode = '2d';

  map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-left');

  map.on('load', () => {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
    });

    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0, 90],
        'sky-atmosphere-sun-intensity': 15,
      },
    });

    map.addLayer({
      id: 'buildings',
      source: 'composite',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 12,
      paint: {
        'fill-extrusion-color': '#7dd3fc',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'min_height']],
        'fill-extrusion-opacity': 0.82,
      },
    });

    applyMapView('2d');
  });

  map.on('error', (event) => {
    console.error('Mapbox error:', event.error);
    const box = errorBoxRef?.current;
    if (box) {
      box.textContent = 'Map failed to load. Please check your Mapbox token and network access.';
      box.classList.remove('hidden');
    }
  });

  function applyMapView(nextMode) {
    mapMode = nextMode;
    onModeChange?.(nextMode);

    if (mapMode === '2d') {
      map.setTerrain(null);
      map.flyTo({
        center: [101.7069, 3.139],
        zoom: 12.3,
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
      return;
    }

    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.flyTo({
      center: [101.7069, 3.139],
      zoom: 13,
      pitch: 63,
      bearing: -15,
      duration: 1200,
    });
  }

  return {
    map,
    getMode: () => mapMode,
    applyMapView,
  };
}
