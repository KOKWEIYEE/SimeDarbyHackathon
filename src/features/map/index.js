import mapboxgl from 'mapbox-gl';
import './styles.css';
import { PLACES_DATA, PRESET_LOCATIONS } from './placesData.js';
import {
  ALL_CATEGORY_ITEMS,
  CATEGORY_GROUPS,
  CATEGORIES_BY_ID,
  CATEGORY_SHAPES,
  getCategoryShapeSvg,
  getCategoryMeta,
} from './categories.js';
import {
  geometryContains,
  polygonContains,
  mergeComplexes,
  floorOrder,
  floorLabel,
  floorFromText,
} from './services/complexesService.js';
import { fetchIsochrones, MAPBOX_ISOCHRONE_URL, ISOCHRONE_COLORS, MODE_LABEL } from './services/isochroneService.js';
import { loadFromGoogle, CellBounds, cleanApiKey } from './services/googlePlacesService.js';
import { searchNearbyPlaces } from './services/placesService.js';
import { searchPlace, reverseGeocode } from './services/geocodingService.js';
import {
  getActiveTransitRoutes,
  getActiveTransitRoutesWithGoogleFirst,
  getTransitRouteForStation,
  findLinesForStation,
  isTransportStation,
} from './services/transitRoutes.js';

export {
  PLACES_DATA,
  PRESET_LOCATIONS,
  ALL_CATEGORY_ITEMS,
  CATEGORY_GROUPS,
  CATEGORIES_BY_ID,
  CATEGORY_SHAPES,
  getCategoryShapeSvg,
  getCategoryMeta,
  searchNearbyPlaces,
  searchPlace,
  reverseGeocode,
  fetchIsochrones,
  isTransportStation,
};

function getGeojsonBounds(geojsonGeometry) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const update = (lng, lat) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  };
  const polys = geojsonGeometry.type === 'MultiPolygon' ? geojsonGeometry.coordinates : [geojsonGeometry.coordinates];
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        update(lng, lat);
      }
    }
  }
  return {
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
    bbox: [[minLng, minLat], [maxLng, maxLat]],
  };
}

export function initMapFeature({
  apiKey,
  googleApiKey = '',
  mapContainerRef,
  errorBoxRef,
  onModeChange,
  onLocationPick,
}) {
  const container = mapContainerRef?.current;

  if (!container) {
    throw new Error('Map container ref is required.');
  }

  mapboxgl.accessToken = apiKey;

  let currentOrigin = {
    coords: [101.7069, 3.1390],
    name: 'Sime Darby Centre',
    address: '19, Jalan Pudu, Bukit Bintang, 55100 Kuala Lumpur',
    type: 'Commercial HQ',
  };

  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/light-v11',
    center: currentOrigin.coords,
    zoom: 12.3,
    pitch: 0,
    bearing: 0,
    antialias: true,
    attributionControl: true,
    preserveDrawingBuffer: true,
  });

  let mapMode = '2d';
  let activeMarkers = [];
  let originMarker = null;
  let siteAMarker = null;
  let siteBMarker = null;
  let isComparisonActive = false;

  // Analysis state: FALSE at default — NO amenities labeled until user clicks Run Analysis!
  let isAnalysisActive = false;
  let activeIsochroneGeometry = null;
  let lastIsoFeatures = [];
  let lastRawPlacesData = null; // cached raw { pois, complexes, source } from Google
  let lastTravelParams = { profile: 'walking', maxMinutes: 20 };

  map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-left');

  function renderOriginMarker() {
    if (originMarker) {
      originMarker.remove();
      originMarker = null;
    }

    if (isComparisonActive) return;

    const pinEl = document.createElement('div');
    pinEl.className = 'user-origin-pin';
    pinEl.innerHTML = `
      <div class="user-origin-pin-card">
        <span class="user-origin-pin-title">${currentOrigin.name}</span>
        <span class="user-origin-pin-addr">📍 ${currentOrigin.address || 'Kuala Lumpur, Malaysia'}</span>
      </div>
      <div class="user-origin-pin-icon">
        <svg width="30" height="40" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14 24.5 15.143 25.619a1.2 1.2 0 001.714 0C18 40.5 32 26.667 32 16 32 7.163 24.837 0 16 0z" fill="#ef4444"/>
          <circle cx="16" cy="15" r="6" fill="#ffffff"/>
          <circle cx="16" cy="15" r="3" fill="#ef4444"/>
        </svg>
        <div class="user-origin-pin-shadow"></div>
      </div>
    `;

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px;">
        <div style="font-size: 10.5px; font-weight: 800; color: #ef4444; text-transform: uppercase; margin-bottom: 2px;">📍 Chosen Analysis Location</div>
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 3px;">${currentOrigin.name}</strong>
        <div style="color: #475569; font-size: 12px; margin-bottom: 6px;">📍 ${currentOrigin.address || 'Kuala Lumpur, Malaysia'}</div>
        <div style="font-size: 10px; color: #94a3b8;">Coords: ${currentOrigin.coords[1]}, ${currentOrigin.coords[0]}</div>
      </div>
    `;
    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '280px' })
      .setHTML(popupHtml);

    originMarker = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
      .setLngLat(currentOrigin.coords)
      .setPopup(popup)
      .addTo(map);
  }

  function createSitePin(site, labelLetter, color) {
    const el = document.createElement('div');
    el.className = `user-origin-pin ${labelLetter === 'A' ? 'site-a-pin' : 'site-b-pin'}`;
    el.innerHTML = `
      <div class="user-origin-pin-card">
        <span class="user-origin-pin-title">Site ${labelLetter}: ${site.name}</span>
        <span class="user-origin-pin-addr">📍 ${site.address || 'Kuala Lumpur, Malaysia'}</span>
      </div>
      <div class="user-origin-pin-icon">
        <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14 24.5 15.143 25.619a1.2 1.2 0 001.714 0C18 40.5 32 26.667 32 16 32 7.163 24.837 0 16 0z" fill="${color}"/>
          <circle cx="16" cy="15" r="7" fill="#ffffff"/>
          <text x="16" y="19" font-size="11" font-weight="900" fill="${color}" text-anchor="middle">${labelLetter}</text>
        </svg>
        <div class="user-origin-pin-shadow"></div>
      </div>
    `;

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px;">
        <div style="font-size: 11px; font-weight: 800; color: ${color}; text-transform: uppercase; margin-bottom: 2px;">Site ${labelLetter} Selected</div>
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 3px;">${site.name}</strong>
        <div style="color: #475569; font-size: 12px; margin-bottom: 4px;">📍 ${site.address || 'Kuala Lumpur, Malaysia'}</div>
        <div style="font-size: 10px; color: #94a3b8;">Coords: ${site.coords[1]}, ${site.coords[0]}</div>
      </div>
    `;
    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '280px' }).setHTML(popupHtml);

    return new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(site.coords)
      .setPopup(popup)
      .addTo(map);
  }

  function updateOrigin({ coords, name, type, address }) {
    currentOrigin = {
      coords,
      name,
      type,
      address: address || currentOrigin.address || 'Kuala Lumpur, Malaysia',
    };
    renderOriginMarker();
  }

  renderOriginMarker();

  function clearTransitRoutes() {
    const src = map.getSource('transit-routes');
    if (src) {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  // Allow clicking on map to choose a custom location with automatic reverse geocoding
  map.on('click', async (e) => {
    const target = e.originalEvent.target;
    if (target && (target.closest('.amenity-pure-marker') || target.closest('.complex-marker') || target.closest('.user-origin-pin') || target.closest('.mapboxgl-popup'))) {
      return;
    }

    clearTransitRoutes();

    const lng = Number(e.lngLat.lng.toFixed(4));
    const lat = Number(e.lngLat.lat.toFixed(4));

    // Show immediate responsive marker
    const tempLoc = {
      id: 'custom-' + Date.now(),
      coords: [lng, lat],
      name: `Point (${lat}, ${lng})`,
      address: 'Resolving address...',
      type: 'Pinned Location',
    };
    updateOrigin(tempLoc);

    try {
      const geo = await reverseGeocode(lng, lat, apiKey);
      const resolvedLoc = {
        id: tempLoc.id,
        coords: [lng, lat],
        name: geo.name || `Location (${lat}, ${lng})`,
        address: geo.address || `${lat}, ${lng}, Kuala Lumpur, Malaysia`,
        type: 'Pinned Location',
      };
      updateOrigin(resolvedLoc);
      onLocationPick?.(resolvedLoc);
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      onLocationPick?.(tempLoc);
    }
  });

  function clearPOIs() {
    activeMarkers.forEach((m) => m.remove());
    activeMarkers = [];
  }

  function addPlaceMarker(item, center, profile) {
    const cat = item.cat || {
      color: '#2563eb',
      label: item.categoryId || 'Place',
      shape: 'circle',
      shapeSymbol: '●',
    };
    const shape = cat.shape || 'circle';
    const shapeColor = cat.color || '#2563eb';

    const isTransport = isTransportStation(item);
    const matchedLines = isTransport ? findLinesForStation(item) : [];

    const shapeSvgPin = getCategoryShapeSvg(shape, 14, shapeColor, '#ffffff');
    const shapeSvgLabel = getCategoryShapeSvg(shape, 10, shapeColor, '#ffffff');

    const el = document.createElement('div');
    el.className = `amenity-pure-marker shape-marker-${shape}`;
    el.innerHTML = `
      <span class="amenity-shape-pin">${shapeSvgPin}</span>
      <div class="amenity-pure-label" style="border-left: 3.5px solid ${shapeColor};">
        <span class="amenity-pure-name">${item.name}</span>
        <span class="amenity-pure-type" style="color: ${shapeColor}; background-color: ${shapeColor}18; border: 1px solid ${shapeColor}35; border-radius: 4px; padding: 1px 6px;">
          <span class="amenity-type-shape">${shapeSvgLabel}</span>
          ${cat.label}
        </span>
        ${item.address ? `<span class="amenity-pure-addr">${item.address}</span>` : ''}
      </div>
    `;

    // Only mark transit route line for genuine transport stations!
    el.addEventListener('click', async () => {
      if (isTransport && matchedLines.length > 0) {
        await showTransitRouteForStation(item);
      } else {
        clearTransitRoutes();
      }
    });

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 3px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px;">
          ${getCategoryShapeSvg(shape, 15, shapeColor, '#ffffff')}
          <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #ffffff; background-color: ${shapeColor};">
            ${cat.label}
          </span>
        </div>
        <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-bottom: 3px; font-weight: 800;">${item.name}</strong>
        ${item.address ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">📍 ${item.address}</div>` : ''}
        ${item.cuisine ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">Cuisine: ${item.cuisine}</div>` : ''}
        ${isTransport && matchedLines.length ? `
          <div style="margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 11.5px;">
            <div style="font-weight: 800; color: #1d4ed8; margin-bottom: 3px;">Transit Route${matchedLines.length > 1 ? 's' : ''}:</div>
            ${matchedLines.map((l) => `
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; font-weight: 700; color: #0f172a;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${l.color}; flex-shrink: 0;"></span>
                <span>${l.name}</span>
              </div>
            `).join('')}
            <div style="font-size: 10px; color: #3b82f6; margin-top: 4px; font-weight: 600;">(Line marked on map)</div>
          </div>
        ` : ''}
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '250px' })
      .setHTML(popupHtml);

    popup.on('open', async () => {
      if (isTransport && matchedLines.length > 0) {
        await showTransitRouteForStation(item);
      } else {
        clearTransitRoutes();
      }
    });

    const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
      .setLngLat([item.lon, item.lat])
      .setPopup(popup)
      .addTo(map);

    activeMarkers.push(marker);
  }

  function addComplexMarker(cx) {
    const center = cx.bounds.getCenter();
    const el = document.createElement('div');
    el.className = 'complex-marker';
    el.title = `${cx.name} (${cx.items.length} places inside)`;
    el.innerHTML = `
      <div class="complex-icon">${cx.items.length}</div>
    `;

    // Group items by floor inside popup, extracting floor from address when missing
    const byFloor = new Map();
    for (const item of cx.items) {
      const k = item.floor || floorFromText(item.address) || floorFromText(item.name) || '0';
      item.floor = k;
      if (!byFloor.has(k)) byFloor.set(k, []);
      byFloor.get(k).push(item);
    }
    const floors = [...byFloor.keys()].sort((a, b) => floorOrder(a) - floorOrder(b));

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px; max-height: 290px; overflow-y: auto;">
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">${cx.name}</strong>
        <div style="color: #0284c7; font-size: 11.5px; font-weight: 700; margin-bottom: 8px;">${cx.items.length} places inside complex</div>
        ${floors.map((fl) => `
          <div style="font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; margin-top: 6px; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
            ${floorLabel(fl)}
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 6px 0;">
            ${byFloor.get(fl).slice(0, 8).map((it) => {
              const itShape = it.cat?.shape || 'square';
              const itColor = it.cat?.color || '#0284c7';
              return `
              <li style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                <span style="display: inline-flex; align-items: center; flex-shrink: 0;">${getCategoryShapeSvg(itShape, 11, itColor, '#ffffff')}</span>
                <span style="font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.name}</span>
              </li>
              `;
            }).join('')}
          </ul>
        `).join('')}
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: '280px' })
      .setHTML(popupHtml);

    const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
      .setLngLat([center.lng, center.lat])
      .setPopup(popup)
      .addTo(map);

    activeMarkers.push(marker);
  }

  /**
   * Port of app.js renderPlaces with mall/complex clustering and individual POI labeling.
   */
  function renderPlaces({ pois, complexes: rawComplexes, source }, selected, centerLat, centerLng, maxMinutes, profile) {
    clearPOIs();

    const complexes = mergeComplexes(rawComplexes);
    const ownerOf = new Map();
    for (const cx of complexes) for (const k of cx.keys) ownerOf.set(k, cx);

    let items = [];
    for (const poi of pois) {
      // Smallest travel-time band containing the place; skip if beyond the chosen time.
      const band = lastIsoFeatures.find((f) => geometryContains(f.geometry, poi.lon, poi.lat));
      if (!band || (band.properties && band.properties.contour > maxMinutes)) continue;
      items.push({ ...poi, band: band.properties?.contour ?? maxMinutes, point: [poi.lat, poi.lon] });
    }

    // A mall that is itself a listed place counts once
    const ownersCounted = new Set();
    items = items.filter((item) => {
      const owner = ownerOf.get(item.key);
      if (!owner) return true;
      if (ownersCounted.has(owner)) return false;
      ownersCounted.add(owner);
      return true;
    });

    // Attach each place strictly to the building/mall complex containing it.
    // Standalone venues with their own address are NOT gathered into complexes.
    const loose = [];
    for (const item of items) {
      let best = null;
      for (const cx of complexes) {
        if (!cx.isMall) continue;
        if (cx.keys.has(item.key)) continue;
        const inside = cx.bounds.contains(item.point) && cx.parts.some((r) => polygonContains(r, item.lon, item.lat));
        if (!inside) continue;
        if (!best || cx.area < best.area) best = cx;
      }
      if (best) best.items.push(item);
      else loose.push(item);
    }

    // Deduplicate same store listed multiple times inside one complex
    const dropped = new Set();
    for (const cx of complexes) {
      const seen = new Set();
      cx.items = cx.items.filter((item) => {
        if (item.unnamed) return true;
        const k = `${item.cat?.id || item.categoryId}|${item.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
        if (seen.has(k)) {
          dropped.add(item);
          return false;
        }
        seen.add(k);
        return true;
      });
    }

    // Complexes with places inside
    const shown = [];
    for (const cx of complexes) {
      if (!cx.items.length) continue;
      if (cx.items.length < (cx.isMall ? 1 : 2)) loose.push(...cx.items);
      else shown.push(cx);
    }

    shown.forEach(addComplexMarker);
    const shownKeys = new Set(shown.flatMap((cx) => [...cx.keys]));
    for (const item of loose) {
      if (!shownKeys.has(item.key)) {
        addPlaceMarker(item, { lat: centerLat, lng: centerLng }, profile);
      }
    }

    // Compute breakdown of amenities by category type
    const breakdownMap = new Map();
    const countItem = (item) => {
      const catId = item.cat?.id || item.categoryId || 'other';
      const existing = breakdownMap.get(catId) || {
        id: catId,
        label: item.cat?.label || catId,
        color: item.cat?.color || '#0284c7',
        shape: item.cat?.shape || 'circle',
        shapeSymbol: item.cat?.shapeSymbol || '●',
        icon: item.cat?.icon || '📍',
        count: 0,
      };
      existing.count += 1;
      breakdownMap.set(catId, existing);
    };

    for (const cx of shown) {
      for (const item of cx.items) {
        countItem(item);
      }
    }
    for (const item of loose) {
      if (!shownKeys.has(item.key)) {
        countItem(item);
      }
    }

    const renderedPlaces = [
      ...shown.flatMap((cx) => cx.items),
      ...loose.filter((item) => !shownKeys.has(item.key)),
    ];

    const typeBreakdown = Array.from(breakdownMap.values()).sort((a, b) => b.count - a.count);
    const totalCount = shown.reduce((n, cx) => n + cx.items.length, 0) + loose.length;
    return { total: totalCount, shownComplexes: shown.length, source, typeBreakdown, places: renderedPlaces };
  }

  async function showTransitRouteForStation(item) {
    if (!isTransportStation(item)) {
      clearTransitRoutes();
      return;
    }
    const routeData = await getTransitRouteForStation(item);
    const src = map.getSource('transit-routes');
    if (src) {
      src.setData(routeData);
    }
  }

  async function updateTransitRoutes(geom, categoryIds = []) {
    const isTransitSelected = categoryIds.some((id) =>
      ['transport', 'lrt-station', 'train-station', 'monorail-station', 'transit'].includes(id)
    );
    if (!isTransitSelected) {
      clearTransitRoutes();
    }
  }

  /**
   * Update POIs:
   * AT DEFAULT (isAnalysisActive === false), NO AMENITY LABELS ARE SHOWN!
   * Only when isAnalysisActive === true, filters the places within the isochrone.
   */
  function updatePOIs(selectedCategoryIds = []) {
    // RULE: DO NOT label amenities at default! Only label when analysis has been run!
    if (!isAnalysisActive || !activeIsochroneGeometry || !lastRawPlacesData) {
      clearPOIs();
      updateTransitRoutes(null, selectedCategoryIds);
      return null;
    }

    updateTransitRoutes(activeIsochroneGeometry, selectedCategoryIds);

    const selectedSet = new Set(selectedCategoryIds);
    if (selectedSet.size === 0) {
      clearPOIs();
      return { total: 0, shownComplexes: [], typeBreakdown: [], places: [] };
    }

    const selectedCategoryObjects = ALL_CATEGORY_ITEMS.filter((c) => selectedSet.has(c.id));
    const filteredPOIs = lastRawPlacesData.pois.filter((p) => selectedSet.has(p.cat?.id || p.categoryId));
    const filteredData = {
      ...lastRawPlacesData,
      pois: filteredPOIs,
    };

    return renderPlaces(
      filteredData,
      selectedCategoryObjects,
      currentOrigin.coords[1],
      currentOrigin.coords[0],
      lastTravelParams.maxMinutes,
      lastTravelParams.profile
    );
  }

  /**
   * Run Analysis:
   * Exactly ports app.js searchNearby:
   * 1. Fetches isochrone for chosen time and travel method.
   * 2. Fetches chosen amenities using Google Places service.
   * 3. Labels chosen amenities and complexes within that isochrone on the map!
   */
  async function runAnalysis({ origin, mode = 'walking', minutes = 20, selectedCategoryIds = [] }) {
    if (origin) {
      currentOrigin = origin;
      renderOriginMarker();
    }

    isAnalysisActive = true;
    lastTravelParams = { profile: mode, maxMinutes: minutes };
    clearPOIs();

    // 1. Fetch Mapbox Isochrones for ONLY the single chosen travel duration and method
    const [lng, lat] = currentOrigin.coords;
    const features = await fetchIsochrones(mode, lng, lat, apiKey, [minutes]);

    if (!features || features.length === 0) {
      throw new Error('No travel-time isochrones returned for this location.');
    }

    lastIsoFeatures = features;
    const target = lastIsoFeatures.find((f) => f.properties?.contour === minutes) || lastIsoFeatures[0];
    activeIsochroneGeometry = target.geometry;

    // Apply the single chosen isochrone contour to Mapbox layer
    const source = map.getSource('travel-isochrone');
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [target],
      });
    }

    // Fit map bounds to target isochrone
    const { south, west, north, east, bbox } = getGeojsonBounds(activeIsochroneGeometry);
    map.fitBounds(bbox, { padding: 80, duration: 800 });

    // 2. Fetch chosen amenities using Google Map service (Google Places API)
    const selectedSet = new Set(selectedCategoryIds);
    const selectedCategoryObjects = ALL_CATEGORY_ITEMS.filter((c) => selectedSet.has(c.id));

    const keyToUse = cleanApiKey(
      googleApiKey ||
      (import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY || '')
    );

    const cellBounds = new CellBounds(south, west, north, east);
    let data;

    try {
      data = await loadFromGoogle(selectedCategoryObjects, cellBounds, activeIsochroneGeometry, keyToUse);
    } catch (err) {
      console.warn('Google Places load failed:', err);
      data = null;
    }

    // If Google Places returned 0 places, fall back to matching places from PLACES_DATA
    if (!data || !data.pois || data.pois.length === 0) {
      const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
      const fallbackPois = PLACES_DATA.filter((p) => selectedSet.has(p.categoryId)).map((p) => {
        const cat = catMap.get(p.categoryId) || { id: p.categoryId, label: p.categoryId, color: '#2563eb' };
        return {
          key: p.id,
          lat: p.coords[1],
          lon: p.coords[0],
          coords: p.coords,
          cat,
          categoryId: p.categoryId,
          name: p.name,
          address: p.address,
          floor: floorFromText(p.address) || floorFromText(p.name) || null,
        };
      });
      data = {
        pois: fallbackPois,
        complexes: [],
        source: 'Curated GIS Places',
      };
    }

    lastRawPlacesData = data;

    // 3. Render places and label all chosen amenities within the isochrone!
    const stats = renderPlaces(
      data,
      selectedCategoryObjects,
      lat,
      lng,
      minutes,
      mode
    );

    // Clear any previous transit route lines so the line is shown when clicked by user
    const transitSrc = map.getSource('transit-routes');
    if (transitSrc) {
      transitSrc.setData({ type: 'FeatureCollection', features: [] });
    }

    return {
      total: stats.total,
      source: data.source,
      complexes: stats.shownComplexes,
      typeBreakdown: stats.typeBreakdown,
      places: stats.places || [],
      isochroneGeometry: activeIsochroneGeometry,
      origin: currentOrigin,
      mode,
      minutes,
    };
  }

  // Clear isochrone and remove all amenity labels
  function clearIsochrone() {
    isAnalysisActive = false;
    activeIsochroneGeometry = null;
    lastIsoFeatures = [];
    lastRawPlacesData = null;

    const source = map.getSource('travel-isochrone');
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }

    const transitSrc = map.getSource('transit-routes');
    if (transitSrc) {
      transitSrc.setData({ type: 'FeatureCollection', features: [] });
    }

    clearPOIs();
  }

  map.on('load', () => {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
    });

    map.addSource('travel-isochrone', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'travel-isochrone-fill',
      type: 'fill',
      source: 'travel-isochrone',
      paint: {
        'fill-color': ['match', ['get', 'contour'], 10, ISOCHRONE_COLORS[10], 20, ISOCHRONE_COLORS[20], 30, ISOCHRONE_COLORS[30], '#2563eb'],
        'fill-opacity': 0.16,
      },
    });

    map.addLayer({
      id: 'travel-isochrone-line',
      type: 'line',
      source: 'travel-isochrone',
      paint: {
        'line-color': ['match', ['get', 'contour'], 10, ISOCHRONE_COLORS[10], 20, ISOCHRONE_COLORS[20], 30, ISOCHRONE_COLORS[30], '#2563eb'],
        'line-width': 2.5,
      },
    });

    // Site B Isochrone Layer (For Site Comparison mode)
    map.addSource('travel-isochrone-b', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'travel-isochrone-b-fill',
      type: 'fill',
      source: 'travel-isochrone-b',
      paint: {
        'fill-color': '#9333ea',
        'fill-opacity': 0.16,
      },
    });

    map.addLayer({
      id: 'travel-isochrone-b-line',
      type: 'line',
      source: 'travel-isochrone-b',
      paint: {
        'line-color': '#9333ea',
        'line-width': 2.5,
      },
    });

    // Transit Routes Layer (Visible when transit stations are inside isochrone, extends across KL)
    map.addSource('transit-routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      id: 'transit-routes-casing',
      type: 'line',
      source: 'transit-routes',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#0f172a',
        'line-width': 5.5,
        'line-opacity': 0.85,
      },
    });

    map.addLayer({
      id: 'transit-routes-line',
      type: 'line',
      source: 'transit-routes',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3.5,
        'line-opacity': 1,
      },
    });

    map.addLayer({
      id: 'sky',
      type: 'sky',
      layout: {
        visibility: 'none',
      },
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
      layout: {
        visibility: 'none',
      },
      paint: {
        'fill-extrusion-color': '#cbd5e1',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'min_height']],
        'fill-extrusion-opacity': 0.8,
      },
    });

    applyMapView('2d');
    // Ensure map starts clean: NO AMENITIES LABELED AT DEFAULT!
    clearPOIs();
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
      if (map.getLayer('buildings')) {
        map.setLayoutProperty('buildings', 'visibility', 'none');
      }
      if (map.getLayer('sky')) {
        map.setLayoutProperty('sky', 'visibility', 'none');
      }
      map.flyTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
      return;
    }

    if (map.getLayer('buildings')) {
      map.setLayoutProperty('buildings', 'visibility', 'visible');
    }
    if (map.getLayer('sky')) {
      map.setLayoutProperty('sky', 'visibility', 'visible');
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.flyTo({
      pitch: 63,
      bearing: -15,
      duration: 1000,
    });
  }

  function toggleLabels(visible) {
    if (visible) {
      container.classList.remove('hide-amenity-labels');
    } else {
      container.classList.add('hide-amenity-labels');
    }
  }

  function addComparativePlaceMarker(item, siteA, siteB) {
    const cat = item.cat || {
      color: '#2563eb',
      label: item.categoryId || 'Place',
      shape: 'circle',
      shapeSymbol: '●',
    };
    const shape = cat.shape || 'circle';
    const shapeColor = cat.color || '#2563eb';

    const shapeSvgPin = getCategoryShapeSvg(shape, 14, shapeColor, '#ffffff');
    const shapeSvgLabel = getCategoryShapeSvg(shape, 10, shapeColor, '#ffffff');

    const siteBadgeColor = item.siteServed === 'both' ? '#ea580c' : item.siteServed === 'siteA' ? '#2563eb' : '#9333ea';
    const siteBadgeBg = item.siteServed === 'both' ? '#fff7ed' : item.siteServed === 'siteA' ? '#eff6ff' : '#faf5ff';
    const siteBadgeBorder = item.siteServed === 'both' ? '#fdba74' : item.siteServed === 'siteA' ? '#bfdbfe' : '#e9d5ff';
    const siteTagText = item.siteServed === 'both' ? 'Shared: Sites A & B' : item.siteServed === 'siteA' ? `Site A: ${siteA.name}` : `Site B: ${siteB.name}`;

    const el = document.createElement('div');
    el.className = `amenity-pure-marker shape-marker-${shape}`;
    el.innerHTML = `
      <span class="amenity-shape-pin">${shapeSvgPin}</span>
      <div class="amenity-pure-label" style="border-left: 3.5px solid ${shapeColor};">
        <span class="amenity-pure-name">${item.name}</span>
        <span class="amenity-pure-type" style="color: ${shapeColor}; background-color: ${shapeColor}18; border: 1px solid ${shapeColor}35; border-radius: 4px; padding: 1px 6px;">
          <span class="amenity-type-shape">${shapeSvgLabel}</span>
          ${cat.label}
        </span>
        <span style="font-size: 8.5px; font-weight: 700; color: ${siteBadgeColor}; background: ${siteBadgeBg}; border: 1px solid ${siteBadgeBorder}; border-radius: 3px; padding: 1px 4px; margin-top: 2px; width: fit-content;">
          ${siteTagText}
        </span>
      </div>
    `;

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 3px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px;">
          ${getCategoryShapeSvg(shape, 15, shapeColor, '#ffffff')}
          <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #ffffff; background-color: ${shapeColor};">
            ${cat.label}
          </span>
        </div>
        <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-bottom: 3px; font-weight: 800;">${item.name}</strong>
        ${item.address ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">📍 ${item.address}</div>` : ''}
        <div style="margin-top: 6px; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; color: ${siteBadgeColor}; background: ${siteBadgeBg}; border: 1px solid ${siteBadgeBorder};">
          ${item.siteServed === 'both' ? `Serves BOTH ${siteA.name} and ${siteB.name}` : item.siteServed === 'siteA' ? `Reachable from Site A: ${siteA.name}` : `Reachable from Site B: ${siteB.name}`}
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '260px' })
      .setHTML(popupHtml);

    const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
      .setLngLat([item.lon, item.lat])
      .setPopup(popup)
      .addTo(map);

    activeMarkers.push(marker);
  }

  async function runDualSiteAnalysis({ siteA, siteB, mode = 'walking', minutes = 20, selectedCategoryIds = [] }) {
    isComparisonActive = true;
    isAnalysisActive = true;
    lastTravelParams = { profile: mode, maxMinutes: minutes };
    clearPOIs();
    clearTransitRoutes();

    if (originMarker) {
      originMarker.remove();
      originMarker = null;
    }
    if (siteAMarker) {
      siteAMarker.remove();
      siteAMarker = null;
    }
    if (siteBMarker) {
      siteBMarker.remove();
      siteBMarker = null;
    }

    siteAMarker = createSitePin(siteA, 'A', '#2563eb');
    siteBMarker = createSitePin(siteB, 'B', '#9333ea');

    // 1. Fetch Isochrones for Site A and Site B
    const featsA = await fetchIsochrones(mode, siteA.coords[0], siteA.coords[1], apiKey, [minutes]);
    if (!featsA || featsA.length === 0) {
      throw new Error(`No isochrone returned for ${siteA.name}`);
    }
    const targetA = featsA.find((f) => f.properties?.contour === minutes) || featsA[0];

    const featsB = await fetchIsochrones(mode, siteB.coords[0], siteB.coords[1], apiKey, [minutes]);
    if (!featsB || featsB.length === 0) {
      throw new Error(`No isochrone returned for ${siteB.name}`);
    }
    const targetB = featsB.find((f) => f.properties?.contour === minutes) || featsB[0];

    // Update Mapbox layers
    const srcA = map.getSource('travel-isochrone');
    if (srcA) {
      srcA.setData({ type: 'FeatureCollection', features: [targetA] });
    }
    const srcB = map.getSource('travel-isochrone-b');
    if (srcB) {
      srcB.setData({ type: 'FeatureCollection', features: [targetB] });
    }

    // Fit map bounds to encompass both isochrones
    const boundsA = getGeojsonBounds(targetA.geometry);
    const boundsB = getGeojsonBounds(targetB.geometry);
    const combinedBounds = [
      [Math.min(boundsA.west, boundsB.west), Math.min(boundsA.south, boundsB.south)],
      [Math.max(boundsA.east, boundsB.east), Math.max(boundsA.north, boundsB.north)],
    ];
    map.fitBounds(combinedBounds, { padding: 90, duration: 800 });

    // 2. Fetch and categorize places for both sites
    const selectedSet = new Set(selectedCategoryIds);
    const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
    const selectedCategoryObjects = ALL_CATEGORY_ITEMS.filter((c) => selectedSet.has(c.id));

    const south = Math.min(boundsA.south, boundsB.south);
    const west = Math.min(boundsA.west, boundsB.west);
    const north = Math.max(boundsA.north, boundsB.north);
    const east = Math.max(boundsA.east, boundsB.east);

    const keyToUse = cleanApiKey(
      googleApiKey ||
      (import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY || '')
    );
    const cellBounds = new CellBounds(south, west, north, east);

    let data = null;
    try {
      data = await loadFromGoogle(selectedCategoryObjects, cellBounds, null, keyToUse);
    } catch (e) {
      console.warn('Google Places load failed for comparison:', e);
    }

    if (!data || !data.pois || data.pois.length === 0) {
      const fallbackPois = PLACES_DATA.filter((p) => selectedSet.has(p.categoryId)).map((p) => ({
        key: p.id,
        lat: p.coords[1],
        lon: p.coords[0],
        coords: p.coords,
        cat: catMap.get(p.categoryId) || { id: p.categoryId, label: p.categoryId, color: '#2563eb' },
        categoryId: p.categoryId,
        name: p.name,
        address: p.address,
        floor: null,
      }));
      data = { pois: fallbackPois, complexes: [], source: 'Curated GIS Places' };
    }

    const placesA = [];
    const placesB = [];
    const allUnique = new Map();

    for (const poi of data.pois) {
      const inA = geometryContains(targetA.geometry, poi.lon, poi.lat);
      const inB = geometryContains(targetB.geometry, poi.lon, poi.lat);

      if (inA || inB) {
        const item = {
          ...poi,
          point: [poi.lat, poi.lon],
          band: minutes,
          siteServed: inA && inB ? 'both' : inA ? 'siteA' : 'siteB',
        };
        if (inA) placesA.push(item);
        if (inB) placesB.push(item);
        allUnique.set(poi.key, item);
      }
    }

    for (const item of allUnique.values()) {
      addComparativePlaceMarker(item, siteA, siteB);
    }

    function buildSiteStats(placesList, geom) {
      const counts = {};
      for (const p of placesList) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
      const typeBreakdown = Object.keys(counts).map((catId) => {
        const cat = catMap.get(catId) || { label: catId, id: catId };
        return {
          id: catId,
          label: cat.label || catId,
          color: cat.color || '#2563eb',
          shape: cat.shape || 'circle',
          shapeSymbol: cat.shapeSymbol || '●',
          icon: cat.icon || '📍',
          count: counts[catId],
          groupName: cat.groupName || 'Amenity',
        };
      }).sort((a, b) => b.count - a.count);

      return {
        total: placesList.length,
        places: placesList,
        typeBreakdown,
        isochroneGeometry: geom,
      };
    }

    lastComparisonData = {
      siteA,
      siteB,
      targetA,
      targetB,
      placesA,
      placesB,
      combinedBounds,
    };

    return {
      statsA: buildSiteStats(placesA, targetA.geometry),
      statsB: buildSiteStats(placesB, targetB.geometry),
      isochroneGeometryA: targetA.geometry,
      isochroneGeometryB: targetB.geometry,
    };
  }

  let lastComparisonData = null;
  let splitMapB = null;
  let splitMapBMarkers = [];
  let splitSyncListeners = null;

  function startSplitMapB({ containerB }) {
    if (!containerB || !lastComparisonData) return null;
    if (splitMapB) {
      stopSplitMapB();
    }

    const { siteB, targetB, placesB } = lastComparisonData;

    // In split mode, base map represents Site A only; hide Site B isochrone and marker on base map
    if (map && map.isStyleLoaded && map.isStyleLoaded()) {
      if (map.getLayer('travel-isochrone-b-fill')) {
        map.setLayoutProperty('travel-isochrone-b-fill', 'visibility', 'none');
      }
      if (map.getLayer('travel-isochrone-b-line')) {
        map.setLayoutProperty('travel-isochrone-b-line', 'visibility', 'none');
      }
    }
    if (siteBMarker && siteBMarker.getElement()) {
      siteBMarker.getElement().style.display = 'none';
    }

    splitMapB = new mapboxgl.Map({
      container: containerB,
      style: 'mapbox://styles/mapbox/light-v11',
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      antialias: true,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    let isSyncing = false;
    const syncAtoB = () => {
      if (isSyncing || !splitMapB) return;
      isSyncing = true;
      splitMapB.jumpTo({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
      isSyncing = false;
    };

    const syncBtoA = () => {
      if (isSyncing || !splitMapB) return;
      isSyncing = true;
      map.jumpTo({
        center: splitMapB.getCenter(),
        zoom: splitMapB.getZoom(),
        bearing: splitMapB.getBearing(),
        pitch: splitMapB.getPitch(),
      });
      isSyncing = false;
    };

    map.on('move', syncAtoB);
    splitMapB.on('move', syncBtoA);

    splitSyncListeners = { syncAtoB, syncBtoA };

    splitMapB.on('load', () => {
      splitMapB.addSource('split-isochrone-b', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: targetB ? [targetB] : [],
        },
      });

      splitMapB.addLayer({
        id: 'split-isochrone-b-fill',
        type: 'fill',
        source: 'split-isochrone-b',
        paint: {
          'fill-color': '#9333ea',
          'fill-opacity': 0.22,
        },
      });

      splitMapB.addLayer({
        id: 'split-isochrone-b-line',
        type: 'line',
        source: 'split-isochrone-b',
        paint: {
          'line-color': '#9333ea',
          'line-width': 2.5,
        },
      });

      // Pin for Site B
      const pinEl = document.createElement('div');
      pinEl.className = 'user-origin-pin site-origin-pin site-origin-b';
      pinEl.innerHTML = `
        <div class="user-origin-pin-card" style="border-left: 3.5px solid #9333ea;">
          <span style="background: #9333ea; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 2px;">SITE B</span>
          <span class="user-origin-pin-title">${siteB.name}</span>
          <span class="user-origin-pin-addr">📍 ${siteB.address || 'Kuala Lumpur'}</span>
        </div>
        <div class="user-origin-pin-icon" style="background: #9333ea; border-color: #fff;">B</div>
        <div class="user-origin-pin-pulse" style="border-color: #9333ea;"></div>
      `;

      const mB = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat(siteB.coords)
        .addTo(splitMapB);
      splitMapBMarkers.push(mB);

      // Places for Site B
      if (placesB && placesB.length) {
        for (const item of placesB) {
          const cat = item.cat || { color: '#9333ea', label: item.categoryId || 'Place', shape: 'circle' };
          const el = document.createElement('div');
          el.className = 'amenity-pure-marker';
          const shapeSvg = getCategoryShapeSvg(cat.shape || 'circle', 14, cat.color || '#9333ea', '#ffffff');
          el.innerHTML = `
            <div class="amenity-marker-anchor">${shapeSvg}</div>
            <div class="amenity-label-card">
              <span class="amenity-label-shape">${getCategoryShapeSvg(cat.shape || 'circle', 10, cat.color || '#9333ea', '#ffffff')}</span>
              <span class="amenity-label-text">${item.name}</span>
            </div>
          `;
          const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
            .setLngLat([item.lon, item.lat])
            .addTo(splitMapB);
          splitMapBMarkers.push(marker);
        }
      }
    });

    return splitMapB;
  }

  function stopSplitMapB() {
    if (splitSyncListeners) {
      if (map && map.off) {
        map.off('move', splitSyncListeners.syncAtoB);
      }
      splitSyncListeners = null;
    }
    splitMapBMarkers.forEach((m) => m.remove());
    splitMapBMarkers = [];
    if (splitMapB) {
      splitMapB.remove();
      splitMapB = null;
    }

    // Restore Site B layers and marker on base map
    if (map && map.isStyleLoaded && map.isStyleLoaded()) {
      if (map.getLayer('travel-isochrone-b-fill')) {
        map.setLayoutProperty('travel-isochrone-b-fill', 'visibility', 'visible');
      }
      if (map.getLayer('travel-isochrone-b-line')) {
        map.setLayoutProperty('travel-isochrone-b-line', 'visibility', 'visible');
      }
    }
    if (siteBMarker && siteBMarker.getElement()) {
      siteBMarker.getElement().style.display = '';
    }
  }

  function clearComparison() {
    isComparisonActive = false;
    stopSplitMapB();
    lastComparisonData = null;
    if (siteAMarker) {
      siteAMarker.remove();
      siteAMarker = null;
    }
    if (siteBMarker) {
      siteBMarker.remove();
      siteBMarker = null;
    }
    if (map && map.isStyleLoaded && map.isStyleLoaded()) {
      const srcB = map.getSource('travel-isochrone-b');
      if (srcB) {
        srcB.setData({ type: 'FeatureCollection', features: [] });
      }
    }
    renderOriginMarker();
  }

  return {
    map,
    getMode: () => mapMode,
    applyMapView,
    runAnalysis,
    runDualSiteAnalysis,
    startSplitMapB,
    stopSplitMapB,
    getComparisonData: () => lastComparisonData,
    clearComparison,
    clearIsochrone,
    clearTransitRoutes,
    updatePOIs,
    updateOrigin,
    toggleLabels,
    getMapCanvas: () => map.getCanvas(),
    getOrigin: () => currentOrigin,
    getIsochroneGeometry: () => activeIsochroneGeometry,
    flyTo: (coords) => map.flyTo({ center: coords, duration: 800 }),
  };
}
