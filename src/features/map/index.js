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
import { getMapboxToken } from './services/mapboxTokenService.js';

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
  getMapboxToken,
};

export function getLocationRequirement(poi) {
  if (!poi) return null;
  const name = String(poi.name || '').toLowerCase();
  const cat = String(poi.categoryId || poi.category || '').toLowerCase();

  // 1. Private University / College / Higher Education / School
  if (
    cat.includes('education') ||
    cat.includes('university') ||
    cat.includes('college') ||
    cat.includes('school') ||
    /\b(university|college|campus|inti|sunway|monash|taylor|taylors|ucsi|apu|segi|klmu|cyberjaya|kdu|tarc|mdis|sekolah|academy|institute|faculty|utar|imu|aimst|help|unikl|nottingham|curtin|swinburne|heriot)\b/i.test(name)
  ) {
    if (
      /\b(private|campus|university|college|academy|institute|faculty)\b/i.test(name) ||
      /\b(inti|sunway|monash|taylor|ucsi|apu|segi|kdu|tarc|mdis|utar|imu|aimst|help|unikl|nottingham|curtin|swinburne|heriot)\b/i.test(name)
    ) {
      return {
        type: 'student',
        identityNeeded: 'Student Identity (Student ID)',
        badge: 'Student Identity (Student ID) Required',
        shortBadge: 'Student ID Required',
        desc: 'Valid student ID or authorized campus student pass required for entry.',
      };
    }
    return {
      type: 'student',
      identityNeeded: 'Student / Visitor Registration',
      badge: 'Student / Visitor Registration Required',
      shortBadge: 'Registration Required',
      desc: 'Identification or campus visitor registration required at entrance.',
    };
  }

  // 2. Embassies / Diplomatic Missions
  if (/\b(embassy|consulate|high commission|chancery|kedutaan)\b/i.test(name)) {
    return {
      type: 'diplomatic',
      identityNeeded: 'Passport & Appointment Pass',
      badge: 'Passport & Consular Appointment Required',
      shortBadge: 'Passport Required',
      desc: 'Valid passport and advance security clearance required.',
    };
  }

  // 3. Private Clubs / Golf / Sports Resorts
  if (/\b(golf|country club|private club|racquet club|resort club|royal selangor)\b/i.test(name)) {
    return {
      type: 'member',
      identityNeeded: 'Member Card / Club ID',
      badge: 'Membership Identity Required',
      shortBadge: 'Member ID Required',
      desc: 'Club member card or guest invitation required.',
    };
  }

  // 4. Specialized Healthcare / Hospitals
  if (/\b(hospital|specialist centre|medical centre|rehab centre)\b/i.test(name) && !/\b(clinic|pharmacy)\b/i.test(name)) {
    return {
      type: 'medical',
      identityNeeded: 'Visitor Pass / Patient Registration',
      badge: 'Hospital Visitor Registration Required',
      shortBadge: 'Visitor Pass Required',
      desc: 'Patient or visitor security registration required at front desk.',
    };
  }

  // 5. Corporate Towers / High Security Office / Government
  if (/\b(menara|tower|headquarters|hq|ministry|kementerian|jabatan|court|mahkamah|suruhanjaya)\b/i.test(name) && !/\b(mall|plaza|shopping)\b/i.test(name)) {
    return {
      type: 'security',
      identityNeeded: 'National ID / Government IC / Visitor Badge',
      badge: 'National ID & Lobby Registration Required',
      shortBadge: 'National ID Required',
      desc: 'National IC / Passport exchange for electronic visitor access badge.',
    };
  }

  // 6. Gated Condominiums / Private Residences
  if (/\b(residence|condominium|condo|residensi|apartment|suites)\b/i.test(name) && !/\b(hotel|inn|motel)\b/i.test(name)) {
    return {
      type: 'residential',
      identityNeeded: 'Resident Access / Visitor QR Code',
      badge: 'Guardhouse Visitor Registration Required',
      shortBadge: 'Visitor Registration',
      desc: 'Intercom verification or resident pre-approved QR pass required.',
    };
  }

  return null;
}

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
  getPinMode,
}) {
  const container = mapContainerRef?.current;

  if (!container) {
    throw new Error('Map container ref is required.');
  }

  mapboxgl.accessToken = apiKey;

  let currentOrigin = {
    coords: [101.7069, 3.1390],
    name: 'Sime Darby Centre',
    shortName: 'Sime Darby Centre',
    address: '19, Jalan Pudu, Bukit Bintang, 55100 Kuala Lumpur',
    type: 'Commercial HQ',
  };

  let currentSiteB = {
    coords: [101.7134, 3.1488],
    name: 'Pavilion Kuala Lumpur',
    shortName: 'Pavilion KL',
    address: '168 Bukit Bintang Road, Bukit Bintang, 55100 Kuala Lumpur',
    type: 'Comparison Site',
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

  // Amenity labels are enabled by default for clear location visibility
  container.classList.remove('hide-amenity-labels');

  let mapMode = '2d';
  let activeMarkers = [];
  let originMarker = null;
  let siteAMarker = null;
  let siteBMarker = null;
  let destinationMarker = null;
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

    const shortTitle = currentOrigin.shortName || (currentOrigin.name ? currentOrigin.name.split(',')[0].trim() : 'Chosen Location');
    const req = getLocationRequirement(currentOrigin);
    const pinEl = document.createElement('div');
    pinEl.className = 'user-origin-pin';
    pinEl.innerHTML = `
      <div class="user-origin-pin-card">
        <div class="user-origin-pin-header">
          <span class="user-origin-pin-title">${shortTitle}</span>
          <button type="button" class="pin-expand-arrow" title="Toggle full address">▾</button>
        </div>
        <div class="user-origin-pin-addr-expanded" style="display: none;">
          <span class="user-origin-pin-addr">📍 ${currentOrigin.address || 'Kuala Lumpur, Malaysia'}</span>
          ${req ? `<div class="location-req-badge dark" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;">
            <span style="font-weight: 800; color: #fde047;">🪪 Identity Needed:</span>
            <span style="font-weight: 700; color: #ffffff; margin-left: 2px;">${req.identityNeeded || req.badge}</span>
          </div>` : ''}
        </div>
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

    const expandBtn = pinEl.querySelector('.pin-expand-arrow');
    const expandedDiv = pinEl.querySelector('.user-origin-pin-addr-expanded');
    if (expandBtn && expandedDiv) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = expandedDiv.style.display === 'none';
        expandedDiv.style.display = isHidden ? 'block' : 'none';
        expandBtn.textContent = isHidden ? '▴' : '▾';
      });
    }

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px;">
        <div style="font-size: 10.5px; font-weight: 500; color: #ef4444; text-transform: uppercase; margin-bottom: 2px;">📍 Chosen Analysis Location</div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <strong style="font-size: 14px; color: #0f172a;">${shortTitle}</strong>
          <button type="button" class="pin-expand-arrow origin-popup-addr-toggle" style="background: #e2e8f0; color: #1e293b; padding: 1px 6px; font-size: 10px; border-radius: 4px; border: none; cursor: pointer;">Address ▾</button>
        </div>
        <div class="origin-popup-addr-box" style="display: none; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          <div style="color: #475569; font-size: 12px; margin-bottom: 3px;">📍 ${currentOrigin.address || 'Kuala Lumpur, Malaysia'}</div>
          ${req ? `<div class="location-req-badge" style="margin-top: 5px; display: block; line-height: 1.35; padding: 4px 7px;">
            <div style="font-weight: 800; font-size: 11px;">🪪 Identity Needed: ${req.identityNeeded}</div>
            <div style="font-size: 10px; color: #78350f; font-weight: 600; margin-top: 1px;">(${req.badge})</div>
            <div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">${req.desc}</div>
          </div>` : ''}
        </div>
      </div>
    `;
    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '280px' })
      .setHTML(popupHtml);

    popup.on('open', () => {
      const pBtn = popup.getElement()?.querySelector('.origin-popup-addr-toggle');
      const pBox = popup.getElement()?.querySelector('.origin-popup-addr-box');
      if (pBtn && pBox) {
        pBtn.onclick = () => {
          const isClosed = pBox.style.display === 'none';
          pBox.style.display = isClosed ? 'block' : 'none';
          pBtn.textContent = isClosed ? 'Address ▴' : 'Address ▾';
        };
      }
    });

    originMarker = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
      .setLngLat(currentOrigin.coords)
      .setPopup(popup)
      .addTo(map);
  }

  function createSitePin(site, labelLetter, color) {
    const req = getLocationRequirement(site);
    const shortTitle = site.shortName || (site.name ? site.name.split(',')[0].trim() : `Site ${labelLetter}`);
    const el = document.createElement('div');
    el.className = `user-origin-pin ${labelLetter === 'A' ? 'site-a-pin' : 'site-b-pin'}`;
    el.innerHTML = `
      <div class="user-origin-pin-card">
        <div class="user-origin-pin-header">
          <span class="user-origin-pin-title">Site ${labelLetter}: ${shortTitle}</span>
          <button type="button" class="pin-expand-arrow" title="Toggle address">▾</button>
        </div>
        <div class="user-origin-pin-addr-expanded" style="display: none;">
          <span class="user-origin-pin-addr">📍 ${site.address || 'Kuala Lumpur, Malaysia'}</span>
          ${req ? `<div class="location-req-badge dark" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;">
            <span style="font-weight: 800; color: #fde047;">🪪 Identity Needed:</span>
            <span style="font-weight: 700; color: #ffffff; margin-left: 2px;">${req.identityNeeded || req.badge}</span>
          </div>` : ''}
        </div>
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

    const expandBtn = el.querySelector('.pin-expand-arrow');
    const expandedDiv = el.querySelector('.user-origin-pin-addr-expanded');
    if (expandBtn && expandedDiv) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = expandedDiv.style.display === 'none';
        expandedDiv.style.display = isHidden ? 'block' : 'none';
        expandBtn.textContent = isHidden ? '▴' : '▾';
      });
    }

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px;">
        <div style="font-size: 11px; font-weight: 500; color: ${color}; text-transform: uppercase; margin-bottom: 2px;">Site ${labelLetter} Selected</div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <strong style="font-size: 14px; color: #0f172a;">${shortTitle}</strong>
          <button type="button" class="pin-expand-arrow site-popup-addr-toggle" style="background: #f1f5f9; color: #1e293b; padding: 1px 6px; font-size: 10px; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;">Address ▾</button>
        </div>
        <div class="site-popup-addr-box" style="display: none; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          <div style="color: #475569; font-size: 12px; margin-bottom: 3px;">📍 ${site.address || 'Kuala Lumpur, Malaysia'}</div>
          ${req ? `<div class="location-req-badge" style="margin-top: 5px; display: block; line-height: 1.35; padding: 4px 7px;">
            <div style="font-weight: 800; font-size: 11px;">🪪 Identity Needed: ${req.identityNeeded}</div>
            <div style="font-size: 10px; color: #78350f; font-weight: 600; margin-top: 1px;">(${req.badge})</div>
            <div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">${req.desc}</div>
          </div>` : ''}
        </div>
      </div>
    `;
    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '280px' }).setHTML(popupHtml);

    popup.on('open', () => {
      const pBtn = popup.getElement()?.querySelector('.site-popup-addr-toggle');
      const pBox = popup.getElement()?.querySelector('.site-popup-addr-box');
      if (pBtn && pBox) {
        pBtn.onclick = () => {
          const isClosed = pBox.style.display === 'none';
          pBox.style.display = isClosed ? 'block' : 'none';
          pBtn.textContent = isClosed ? 'Address ▴' : 'Address ▾';
        };
      }
    });

    return new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(site.coords)
      .setPopup(popup)
      .addTo(map);
  }

  function updateOrigin({ coords, name, type, address, shortName }) {
    currentOrigin = {
      coords,
      name,
      shortName: shortName || (name ? name.split(',')[0].trim() : 'Site A'),
      type,
      address: address || currentOrigin.address || 'Kuala Lumpur, Malaysia',
    };
    if (isComparisonActive) {
      if (siteAMarker) siteAMarker.remove();
      siteAMarker = createSitePin(currentOrigin, 'A', '#2563eb');
    } else {
      renderOriginMarker();
    }
  }

  function updateSiteB({ coords, name, type, address, shortName }) {
    currentSiteB = {
      coords,
      name,
      shortName: shortName || (name ? name.split(',')[0].trim() : 'Site B'),
      type,
      address: address || currentSiteB.address || 'Kuala Lumpur, Malaysia',
    };
    if (isComparisonActive) {
      if (siteBMarker) siteBMarker.remove();
      siteBMarker = createSitePin(currentSiteB, 'B', '#9333ea');
    }
  }

  function updateDestination(dest) {
    if (!dest || !dest.coords) {
      clearDestination();
      return;
    }
    if (destinationMarker) {
      destinationMarker.remove();
      destinationMarker = null;
    }
    const shortTitle = dest.shortName || (dest.name ? dest.name.split(',')[0].trim() : 'Destination');
    const el = document.createElement('div');
    el.className = 'user-origin-pin destination-pin';
    el.innerHTML = `
      <div class="user-origin-pin-card" style="border-left: 3.5px solid #059669;">
        <div class="user-origin-pin-header">
          <span style="background: #059669; color: #fff; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-right: 4px;">DESTINATION</span>
          <span class="user-origin-pin-title">${shortTitle}</span>
        </div>
      </div>
      <div class="user-origin-pin-icon" style="background: #059669; border-color: #fff;">
        <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14 24.5 15.143 25.619a1.2 1.2 0 001.714 0C18 40.5 32 26.667 32 16 32 7.163 24.837 0 16 0z" fill="#059669"/>
          <circle cx="16" cy="15" r="7" fill="#ffffff"/>
          <text x="16" y="19" font-size="11" font-weight="900" fill="#059669" text-anchor="middle">🎯</text>
        </svg>
      </div>
      <div class="user-origin-pin-shadow"></div>
    `;
    destinationMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(dest.coords)
      .addTo(map);
  }

  function clearDestination() {
    if (destinationMarker) {
      destinationMarker.remove();
      destinationMarker = null;
    }
  }

  function setComparisonMode(active, siteA = currentOrigin, siteB = currentSiteB) {
    isComparisonActive = active;
    if (active) {
      if (originMarker) {
        originMarker.remove();
        originMarker = null;
      }
      if (siteA) {
        currentOrigin = {
          ...currentOrigin,
          ...siteA,
          shortName: siteA.shortName || (siteA.name ? siteA.name.split(',')[0].trim() : 'Site A'),
        };
      }
      if (siteB) {
        currentSiteB = {
          ...currentSiteB,
          ...siteB,
          shortName: siteB.shortName || (siteB.name ? siteB.name.split(',')[0].trim() : 'Site B'),
        };
      }
      if (siteAMarker) siteAMarker.remove();
      if (siteBMarker) siteBMarker.remove();
      siteAMarker = createSitePin(currentOrigin, 'A', '#2563eb');
      siteBMarker = createSitePin(currentSiteB, 'B', '#9333ea');
    } else {
      if (siteAMarker) {
        siteAMarker.remove();
        siteAMarker = null;
      }
      if (siteBMarker) {
        siteBMarker.remove();
        siteBMarker = null;
      }
      const srcB = map.getSource('travel-isochrone-b');
      if (srcB) {
        srcB.setData({ type: 'FeatureCollection', features: [] });
      }
      renderOriginMarker();
    }
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
    const activePinMode = getPinMode ? getPinMode() : 'none';

    if (activePinMode === 'bookmark') {
      const tempLoc = {
        id: 'fav-' + Date.now(),
        coords: [lng, lat],
        name: `Bookmark (${lat}, ${lng})`,
        shortName: `Bookmark (${lat}, ${lng})`,
        address: 'Resolving address...',
        type: 'Saved Bookmark',
      };

      try {
        const geo = await reverseGeocode(lng, lat, apiKey);
        const resolvedLoc = {
          id: tempLoc.id,
          coords: [lng, lat],
          name: geo.name || 'Saved Bookmark Location',
          shortName: geo.shortName || (geo.name ? geo.name.split(',')[0].trim() : 'Saved Bookmark'),
          address: geo.address || 'Kuala Lumpur, Malaysia',
          type: 'Saved Bookmark',
        };
        onLocationPick?.(resolvedLoc, 'bookmark');
      } catch (err) {
        console.warn('Reverse geocode error Bookmark:', err);
        onLocationPick?.(tempLoc, 'bookmark');
      }
      return;
    }

    if (activePinMode === 'B') {
      const tempLoc = {
        id: 'custom-b-' + Date.now(),
        coords: [lng, lat],
        name: 'Site B (Pinned)',
        shortName: 'Site B',
        address: 'Resolving address...',
        type: 'Pinned Comparison Site',
      };
      updateSiteB(tempLoc);

      try {
        const geo = await reverseGeocode(lng, lat, apiKey);
        const resolvedLoc = {
          id: tempLoc.id,
          coords: [lng, lat],
          name: geo.name || 'Site B (Pinned)',
          shortName: geo.shortName || (geo.name ? geo.name.split(',')[0].trim() : 'Site B'),
          address: geo.address || 'Kuala Lumpur, Malaysia',
          type: 'Pinned Comparison Site',
        };
        updateSiteB(resolvedLoc);
        onLocationPick?.(resolvedLoc, 'B');
      } catch (err) {
        console.warn('Reverse geocode error Site B:', err);
        onLocationPick?.(tempLoc, 'B');
      }
    } else {
      const tempLoc = {
        id: 'custom-a-' + Date.now(),
        coords: [lng, lat],
        name: 'Pinned Location',
        shortName: 'Chosen Location',
        address: 'Resolving address...',
        type: 'Pinned Location',
      };
      updateOrigin(tempLoc);

      try {
        const geo = await reverseGeocode(lng, lat, apiKey);
        const resolvedLoc = {
          id: tempLoc.id,
          coords: [lng, lat],
          name: geo.name || 'Pinned Location',
          shortName: geo.shortName || (geo.name ? geo.name.split(',')[0].trim() : 'Chosen Location'),
          address: geo.address || 'Kuala Lumpur, Malaysia',
          type: 'Pinned Location',
        };
        updateOrigin(resolvedLoc);
        onLocationPick?.(resolvedLoc, 'A');
      } catch (err) {
        console.warn('Reverse geocode error:', err);
        onLocationPick?.(tempLoc, 'A');
      }
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
    const req = getLocationRequirement(item);

    const isTransport = isTransportStation(item);
    const matchedLines = isTransport ? findLinesForStation(item) : [];

    const shapeSvgPin = getCategoryShapeSvg(shape, 14, shapeColor, '#ffffff');
    const shapeSvgLabel = getCategoryShapeSvg(shape, 10, shapeColor, '#ffffff');

    const el = document.createElement('div');
    el.className = `amenity-pure-marker shape-marker-${shape}`;
    el.innerHTML = `
      <span class="amenity-shape-pin">${shapeSvgPin}</span>
      <div class="amenity-pure-label">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <span class="amenity-pure-name">${item.name}</span>
          ${(item.address || req) ? `<button type="button" class="pin-expand-arrow amenity-expand-arrow" style="font-size: 8px; padding: 0 4px;" title="Toggle complete address">▾</button>` : ''}
        </div>
        <span class="amenity-pure-type" style="color: ${shapeColor}; background-color: ${shapeColor}18; border: 1px solid ${shapeColor}35; border-radius: 4px; padding: 1px 6px;">
          <span class="amenity-type-shape">${shapeSvgLabel}</span>
          ${cat.label}
        </span>
        <div class="amenity-expanded-details" style="display: none; margin-top: 3px; padding-top: 2px; border-top: 1px dashed rgba(15,23,42,0.12);">
          ${item.address ? `<span class="amenity-pure-addr" style="display: block;">📍 ${item.address}</span>` : ''}
          ${req ? `<div class="location-req-badge" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;">
            <div style="font-weight: 800; color: #92400e;">🪪 Identity Needed:</div>
            <div style="font-weight: 700; color: #b45309;">${req.identityNeeded || req.badge}</div>
          </div>` : ''}
        </div>
      </div>
    `;

    const expandArrow = el.querySelector('.amenity-expand-arrow');
    const expandedDetails = el.querySelector('.amenity-expanded-details');
    if (expandArrow && expandedDetails) {
      expandArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = expandedDetails.style.display === 'none';
        expandedDetails.style.display = isHidden ? 'block' : 'none';
        expandArrow.textContent = isHidden ? '▴' : '▾';
      });
    }

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
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <strong style="font-size: 13.5px; color: #0f172a; font-weight: 800;">${item.name}</strong>
          ${(item.address || req) ? `<button type="button" class="pin-expand-arrow poi-popup-toggle" style="background: #f1f5f9; color: #334155; padding: 1px 6px; font-size: 10px; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;">Address ▾</button>` : ''}
        </div>
        <div class="poi-popup-expanded" style="display: none; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          ${item.address ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">📍 ${item.address}</div>` : ''}
          ${item.cuisine ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">Cuisine: ${item.cuisine}</div>` : ''}
          ${req ? `
            <div class="location-req-badge" style="margin-top: 5px; display: block; line-height: 1.35; padding: 4px 7px;">
              <div style="font-weight: 800; font-size: 11px;">🪪 Identity Needed: ${req.identityNeeded}</div>
              <div style="font-size: 10px; color: #78350f; font-weight: 600; margin-top: 1px;">(${req.badge})</div>
              <div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">${req.desc}</div>
            </div>` : ''}
        </div>
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
      const pBtn = popup.getElement()?.querySelector('.poi-popup-toggle');
      const pBox = popup.getElement()?.querySelector('.poi-popup-expanded');
      if (pBtn && pBox) {
        pBtn.onclick = () => {
          const isClosed = pBox.style.display === 'none';
          pBox.style.display = isClosed ? 'block' : 'none';
          pBtn.textContent = isClosed ? 'Address ▴' : 'Address ▾';
        };
      }
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

    // Canonical category group sequence lookup map based on CATEGORY_GROUPS
    const groupOrderMap = new Map(CATEGORY_GROUPS.map((g, idx) => [g.id, idx]));

    // Divide amenities inside complex by categories
    const byCategory = new Map();
    for (const item of cx.items) {
      const meta = item.cat || getCategoryMeta(item.categoryId);
      const groupId = meta?.groupId || 'other';
      const groupName = meta?.groupName || meta?.label || 'General Amenities';
      const catShape = meta?.shape || 'square';
      const catColor = meta?.color || '#0284c7';

      if (!byCategory.has(groupId)) {
        const orderIndex = groupOrderMap.has(groupId) ? groupOrderMap.get(groupId) : 999;
        byCategory.set(groupId, {
          groupId,
          groupName,
          orderIndex,
          shape: catShape,
          color: catColor,
          items: [],
        });
      }
      byCategory.get(groupId).items.push(item);
    }

    // Sort category groups strictly based on CATEGORY_GROUPS canonical sequence!
    const catGroups = [...byCategory.values()].sort((a, b) => a.orderIndex - b.orderIndex);

    // Inside each category group, sort amenities consistently by subcategory, then by name
    for (const g of catGroups) {
      g.items.sort((a, b) => {
        const catA = a.cat?.label || a.categoryId || '';
        const catB = b.cat?.label || b.categoryId || '';
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px; max-height: 310px; overflow-y: auto;">
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">${cx.name}</strong>
        <div style="color: #0284c7; font-size: 11.5px; font-weight: 700; margin-bottom: 4px;">${cx.items.length} places inside complex</div>
        
        <!-- Category Summary Badges arranged strictly by category sequence -->
        <div class="complex-cat-summary">
          ${catGroups.map((g) => `
            <span class="complex-cat-pill" style="border-left: 3px solid ${g.color};">
              ${getCategoryShapeSvg(g.shape, 9, g.color, '#ffffff')}
              ${g.groupName.split(' ')[0]}: ${g.items.length}
            </span>
          `).join('')}
        </div>

        <!-- Expand Button for Detailed Category Breakdown -->
        <button type="button" class="complex-expand-btn">
          <span>Amenities by Category (${cx.items.length})</span>
          <span class="complex-expand-arrow">▾</span>
        </button>

        <div class="complex-cat-detail-container" style="display: none;">
          ${catGroups.map((g) => `
            <div class="complex-cat-group-title">
              <span style="display: flex; align-items: center; gap: 5px;">
                ${getCategoryShapeSvg(g.shape, 11, g.color, '#ffffff')}
                <span style="color: ${g.color};">${g.groupName}</span>
              </span>
              <span style="color: #64748b; font-size: 10px;">(${g.items.length})</span>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0 0 6px 0;">
              ${g.items.map((it) => {
                const itReq = getLocationRequirement(it);
                return `
                <li style="display: flex; flex-direction: column; padding: 3px 0; border-bottom: 1px dashed #f1f5f9;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-flex; align-items: center; flex-shrink: 0;">${getCategoryShapeSvg(it.cat?.shape || g.shape, 10, it.cat?.color || g.color, '#ffffff')}</span>
                    <span style="font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px;">${it.name}</span>
                    ${it.floor ? `<span style="font-size: 9.5px; color: #64748b; margin-left: auto; flex-shrink: 0;">${floorLabel(it.floor)}</span>` : ''}
                  </div>
                  ${itReq ? `<div style="font-size: 9.5px; color: #d97706; font-weight: 700; margin-left: 16px;">📋 ${itReq.badge}</div>` : ''}
                </li>
                `;
              }).join('')}
            </ul>
          `).join('')}
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: '280px' })
      .setHTML(popupHtml);

    popup.on('open', () => {
      const expBtn = popup.getElement()?.querySelector('.complex-expand-btn');
      const detContainer = popup.getElement()?.querySelector('.complex-cat-detail-container');
      const expArrow = popup.getElement()?.querySelector('.complex-expand-arrow');
      if (expBtn && detContainer) {
        expBtn.onclick = () => {
          const isClosed = detContainer.style.display === 'none';
          detContainer.style.display = isClosed ? 'block' : 'none';
          if (expArrow) expArrow.textContent = isClosed ? '▴' : '▾';
        };
      }
    });

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

  function buildSiteStats(placesList, geom, catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]))) {
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
      isIsochrone: !!geom,
      isochroneGeometry: geom,
    };
  }

  /**
   * Update POIs:
   * AT DEFAULT (isAnalysisActive === false), NO AMENITY LABELS ARE SHOWN!
   * Only when isAnalysisActive === true, filters the places within the isochrone.
   */
  function updatePOIs(selectedCategoryIds = []) {
    // If dual site comparison is active:
    if (isComparisonActive && lastComparisonData) {
      clearPOIs();
      const selectedSet = new Set(selectedCategoryIds);
      const { siteA, siteB, targetA, targetB, allRawPois, minutes } = lastComparisonData;
      const filteredPois = (allRawPois || []).filter((p) => selectedSet.has(p.cat?.id || p.categoryId));

      const placesA = [];
      const placesB = [];
      const allUnique = new Map();

      for (const poi of filteredPois) {
        const inA = geometryContains(targetA.geometry, poi.lon, poi.lat);
        const inB = geometryContains(targetB.geometry, poi.lon, poi.lat);

        if (inA || inB) {
          const item = {
            ...poi,
            point: [poi.lat, poi.lon],
            band: minutes || 20,
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

      lastComparisonData.placesA = placesA;
      lastComparisonData.placesB = placesB;

      if (splitMapB) {
        renderSplitMapBPlaces(placesB);
      }

      const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
      const statsA = buildSiteStats(placesA, targetA.geometry, catMap);
      const statsB = buildSiteStats(placesB, targetB.geometry, catMap);

      return {
        isComparison: true,
        statsA,
        statsB,
        total: allUnique.size,
      };
    }

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

    const keyToUse = cleanApiKey(googleApiKey);

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

    const req = getLocationRequirement(item);
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
      <div class="amenity-pure-label">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <span class="amenity-pure-name">${item.name}</span>
          ${(item.address || req) ? `<button type="button" class="pin-expand-arrow comp-expand-arrow" style="font-size: 8px; padding: 0 4px;" title="Toggle complete address">▾</button>` : ''}
        </div>
        <span class="amenity-pure-type" style="color: ${shapeColor}; background-color: ${shapeColor}18; border: 1px solid ${shapeColor}35; border-radius: 4px; padding: 1px 6px;">
          <span class="amenity-type-shape">${shapeSvgLabel}</span>
          ${cat.label}
        </span>
        <span style="font-size: 8.5px; font-weight: 700; color: ${siteBadgeColor}; background: ${siteBadgeBg}; border: 1px solid ${siteBadgeBorder}; border-radius: 3px; padding: 1px 4px; margin-top: 2px; width: fit-content;">
          ${siteTagText}
        </span>
        <div class="comp-expanded-details" style="display: none; margin-top: 3px; padding-top: 2px; border-top: 1px dashed rgba(15,23,42,0.12);">
          ${item.address ? `<span class="amenity-pure-addr" style="display: block;">📍 ${item.address}</span>` : ''}
          ${req ? `<div class="location-req-badge" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;">
            <div style="font-weight: 800; color: #92400e;">🪪 Identity Needed:</div>
            <div style="font-weight: 700; color: #b45309;">${req.identityNeeded || req.badge}</div>
          </div>` : ''}
        </div>
      </div>
    `;

    const expandArrow = el.querySelector('.comp-expand-arrow');
    const expandedDetails = el.querySelector('.comp-expanded-details');
    if (expandArrow && expandedDetails) {
      expandArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = expandedDetails.style.display === 'none';
        expandedDetails.style.display = isHidden ? 'block' : 'none';
        expandArrow.textContent = isHidden ? '▴' : '▾';
      });
    }

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 3px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px;">
          ${getCategoryShapeSvg(shape, 15, shapeColor, '#ffffff')}
          <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #ffffff; background-color: ${shapeColor};">
            ${cat.label}
          </span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <strong style="font-size: 13.5px; color: #0f172a; font-weight: 800;">${item.name}</strong>
          ${(item.address || req) ? `<button type="button" class="pin-expand-arrow comp-popup-toggle" style="background: #f1f5f9; color: #334155; padding: 1px 6px; font-size: 10px; border-radius: 4px; border: 1px solid #cbd5e1; cursor: pointer;">Address ▾</button>` : ''}
        </div>
        <div class="comp-popup-expanded" style="display: none; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          ${item.address ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">📍 ${item.address}</div>` : ''}
          ${req ? `
            <div class="location-req-badge" style="margin-top: 5px; display: block; line-height: 1.35; padding: 4px 7px;">
              <div style="font-weight: 800; font-size: 11px;">🪪 Identity Needed: ${req.identityNeeded}</div>
              <div style="font-size: 10px; color: #78350f; font-weight: 600; margin-top: 1px;">(${req.badge})</div>
              <div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">${req.desc}</div>
            </div>` : ''}
        </div>
        <div style="margin-top: 6px; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; color: ${siteBadgeColor}; background: ${siteBadgeBg}; border: 1px solid ${siteBadgeBorder};">
          ${item.siteServed === 'both' ? `Serves BOTH ${siteA.name} and ${siteB.name}` : item.siteServed === 'siteA' ? `Reachable from Site A: ${siteA.name}` : `Reachable from Site B: ${siteB.name}`}
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '260px' })
      .setHTML(popupHtml);

    popup.on('open', () => {
      const pBtn = popup.getElement()?.querySelector('.comp-popup-toggle');
      const pBox = popup.getElement()?.querySelector('.comp-popup-expanded');
      if (pBtn && pBox) {
        pBtn.onclick = () => {
          const isClosed = pBox.style.display === 'none';
          pBox.style.display = isClosed ? 'block' : 'none';
          pBtn.textContent = isClosed ? 'Address ▴' : 'Address ▾';
        };
      }
    });

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

    const keyToUse = cleanApiKey(googleApiKey);
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

    lastComparisonData = {
      siteA,
      siteB,
      targetA,
      targetB,
      placesA,
      placesB,
      combinedBounds,
      allRawPois: data.pois,
      minutes,
    };

    return {
      statsA: buildSiteStats(placesA, targetA.geometry, catMap),
      statsB: buildSiteStats(placesB, targetB.geometry, catMap),
      isochroneGeometryA: targetA.geometry,
      isochroneGeometryB: targetB.geometry,
    };
  }

  let lastComparisonData = null;
  let splitMapB = null;
  let splitMapBMarkers = [];

  function renderSplitMapBPlaces(places) {
    if (!splitMapB) return;
    // Remove old POI markers (keep Site B origin pin which is index 0)
    while (splitMapBMarkers.length > 1) {
      const m = splitMapBMarkers.pop();
      m.remove();
    }

    if (!places || !places.length) return;

    for (const item of places) {
      const cat = item.cat || {
        color: '#9333ea',
        label: item.categoryId || 'Place',
        shape: 'circle',
        shapeSymbol: '●',
      };
      const shape = cat.shape || 'circle';
      const shapeColor = cat.color || '#9333ea';
      const req = getLocationRequirement(item);

      const shapeSvgPin = getCategoryShapeSvg(shape, 14, shapeColor, '#ffffff');
      const shapeSvgLabel = getCategoryShapeSvg(shape, 10, shapeColor, '#ffffff');

      const el = document.createElement('div');
      el.className = `amenity-pure-marker shape-marker-${shape}`;
      el.innerHTML = `
        <span class="amenity-shape-pin">${shapeSvgPin}</span>
        <div class="amenity-pure-label">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span class="amenity-pure-name">${item.name}</span>
            ${(item.address || req) ? `<button type="button" class="pin-expand-arrow split-b-item-expand" style="font-size: 8px; padding: 0 4px;" title="Toggle address">▾</button>` : ''}
          </div>
          <span class="amenity-pure-type" style="color: ${shapeColor}; background-color: ${shapeColor}18; border: 1px solid ${shapeColor}35; border-radius: 4px; padding: 1px 6px;">
            <span class="amenity-type-shape">${shapeSvgLabel}</span>
            ${cat.label}
          </span>
          <div class="split-b-item-details" style="display: none; margin-top: 3px; padding-top: 2px; border-top: 1px dashed rgba(15,23,42,0.12);">
            ${item.address ? `<span class="amenity-pure-addr" style="display: block;">📍 ${item.address}</span>` : ''}
            ${req ? `<div class="location-req-badge" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;">
              <div style="font-weight: 800; color: #92400e;">🪪 Identity Needed:</div>
              <div style="font-weight: 700; color: #b45309;">${req.identityNeeded || req.badge}</div>
            </div>` : ''}
          </div>
        </div>
      `;

      const expandArrow = el.querySelector('.split-b-item-expand');
      const expandedDetails = el.querySelector('.split-b-item-details');
      if (expandArrow && expandedDetails) {
        expandArrow.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = expandedDetails.style.display === 'none';
          expandedDetails.style.display = isHidden ? 'block' : 'none';
          expandArrow.textContent = isHidden ? '▴' : '▾';
        });
      }

      const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
        .setLngLat([item.lon, item.lat])
        .addTo(splitMapB);
      splitMapBMarkers.push(marker);
    }
  }

  function startSplitMapB({ containerB }) {
    if (!containerB || !lastComparisonData) return null;
    if (splitMapB) {
      stopSplitMapB();
    }

    const { siteA, siteB, targetB, placesB } = lastComparisonData;

    // Base map represents Site A: center and fly to Site A
    if (siteA && siteA.coords && map) {
      map.flyTo({
        center: siteA.coords,
        zoom: 13.5,
        essential: true,
      });
    }

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

    // Initialize Split Map B specifically centered on Site B, independently draggable!
    splitMapB = new mapboxgl.Map({
      container: containerB,
      style: 'mapbox://styles/mapbox/light-v11',
      center: siteB.coords,
      zoom: 13.5,
      bearing: 0,
      pitch: 0,
      antialias: true,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    // NOTE: Move sync listeners are intentionally omitted so both maps can be dragged independently!

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

      // Pin for Site B with identity requirement
      const shortTitleB = siteB.shortName || (siteB.name ? siteB.name.split(',')[0].trim() : 'Site B');
      const reqB = getLocationRequirement(siteB);
      const pinEl = document.createElement('div');
      pinEl.className = 'user-origin-pin site-origin-pin site-origin-b';
      pinEl.innerHTML = `
        <div class="user-origin-pin-card">
          <div class="user-origin-pin-header">
            <span style="background: #9333ea; color: #fff; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-right: 4px;">SITE B</span>
            <span class="user-origin-pin-title">${shortTitleB}</span>
            <button type="button" class="pin-expand-arrow split-b-expand-btn" title="Toggle address">▾</button>
          </div>
          <div class="user-origin-pin-addr-expanded split-b-addr-box" style="display: none;">
            <span class="user-origin-pin-addr">📍 ${siteB.address || 'Kuala Lumpur'}</span>
            ${reqB ? `<div class="location-req-badge dark" style="font-size: 9px; padding: 2px 6px; margin-top: 3px; display: block; line-height: 1.3;"><span style="font-weight: 800; color: #fde047;">🪪 Identity Needed:</span> <span style="font-weight: 700; color: #ffffff; margin-left: 2px;">${reqB.identityNeeded || reqB.badge}</span></div>` : ''}
          </div>
        </div>
        <div class="user-origin-pin-icon" style="background: #9333ea; border-color: #fff;">B</div>
        <div class="user-origin-pin-pulse" style="border-color: #9333ea;"></div>
      `;

      const expBtnB = pinEl.querySelector('.split-b-expand-btn');
      const expBoxB = pinEl.querySelector('.split-b-addr-box');
      if (expBtnB && expBoxB) {
        expBtnB.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = expBoxB.style.display === 'none';
          expBoxB.style.display = isHidden ? 'block' : 'none';
          expBtnB.textContent = isHidden ? '▴' : '▾';
        });
      }

      const mB = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat(siteB.coords)
        .addTo(splitMapB);
      splitMapBMarkers.push(mB);

      // Render Places for Site B
      renderSplitMapBPlaces(placesB);
    });

    return splitMapB;
  }

  function stopSplitMapB() {
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

    // Zoom base map back to combined comparison overview
    if (lastComparisonData && lastComparisonData.combinedBounds) {
      map.fitBounds(lastComparisonData.combinedBounds, { padding: 80, duration: 800 });
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
    renderSplitMapBPlaces,
    getSplitMapB: () => splitMapB,
    resize: () => {
      try {
        map?.resize();
        splitMapB?.resize();
      } catch (err) {
        console.warn('Map resize error:', err);
      }
    },
    getComparisonData: () => lastComparisonData,
    clearComparison,
    setComparisonMode,
    clearIsochrone,
    clearTransitRoutes,
    updatePOIs,
    updateOrigin,
    updateSiteB,
    updateDestination,
    clearDestination,
    toggleLabels,
    getMapCanvas: () => map.getCanvas(),
    getOrigin: () => currentOrigin,
    getIsochroneGeometry: () => activeIsochroneGeometry,
    flyTo: (coords) => map.flyTo({ center: coords, duration: 800 }),
  };
}
