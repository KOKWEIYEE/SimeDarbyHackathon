import mapboxgl from "mapbox-gl";
import "./styles.css";
import { PLACES_DATA, PRESET_LOCATIONS } from "./placesData.js";
import {
  ALL_CATEGORY_ITEMS,
  CATEGORY_GROUPS,
  CATEGORIES_BY_ID,
} from "./categories.js";
import {
  geometryContains,
  polygonContains,
  mergeComplexes,
  floorOrder,
  floorLabel,
  floorFromText,
} from "./services/complexesService.js";
import {
  fetchIsochrones,
  MAPBOX_ISOCHRONE_URL,
  ISOCHRONE_COLORS,
  MODE_LABEL,
} from "./services/isochroneService.js";
import {
  loadFromGoogle,
  CellBounds,
  cleanApiKey,
} from "./services/googlePlacesService.js";
import { searchNearbyPlaces } from "./services/placesService.js";
import { searchPlace } from "./services/geocodingService.js";
import {
  getActiveTransitRoutes,
  getActiveTransitRoutesWithGoogleFirst,
  getTransitRouteForStation,
  findLinesForStation,
} from "./services/transitRoutes.js";

export {
  PLACES_DATA,
  PRESET_LOCATIONS,
  ALL_CATEGORY_ITEMS,
  CATEGORY_GROUPS,
  CATEGORIES_BY_ID,
  searchNearbyPlaces,
  searchPlace,
  fetchIsochrones,
};

function getGeojsonBounds(geojsonGeometry) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const update = (lng, lat) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  };
  const polys =
    geojsonGeometry.type === "MultiPolygon"
      ? geojsonGeometry.coordinates
      : [geojsonGeometry.coordinates];
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
    bbox: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
  };
}

export function initMapFeature({
  apiKey,
  googleApiKey = "",
  mapContainerRef,
  errorBoxRef,
  onModeChange,
  onLocationPick,
}) {
  const container = mapContainerRef?.current;

  if (!container) {
    throw new Error("Map container ref is required.");
  }

  mapboxgl.accessToken = apiKey;

  let currentOrigin = {
    coords: [101.7069, 3.139],
    name: "Sime Darby Centre",
    type: "Commercial HQ",
  };

  const map = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/light-v11",
    center: currentOrigin.coords,
    zoom: 12.3,
    pitch: 0,
    bearing: 0,
    antialias: true,
    attributionControl: true,
  });

  let mapMode = "2d";
  let activeMarkers = [];
  let originMarker = null;

  // Analysis state: FALSE at default — NO amenities labeled until user clicks Run Analysis!
  let isAnalysisActive = false;
  let activeIsochroneGeometry = null;
  let lastIsoFeatures = [];
  let lastRawPlacesData = null; // cached raw { pois, complexes, source } from Google
  let lastTravelParams = { profile: "walking", maxMinutes: 20 };

  // Bottom controls are prepended by Mapbox: add fullscreen first so it
  // appears below navigation, with attribution remaining at the very bottom.
  map.addControl(new mapboxgl.FullscreenControl(), "bottom-right");
  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }),
    "bottom-right",
  );

  function renderOriginMarker() {
    if (originMarker) {
      originMarker.remove();
    }

    const pinEl = document.createElement("div");
    pinEl.className = "user-origin-pin";
    pinEl.innerHTML = `
      <div class="user-origin-pin-card">
        <span class="user-origin-pin-title">${currentOrigin.name}</span>
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

    originMarker = new mapboxgl.Marker({ element: pinEl, anchor: "bottom" })
      .setLngLat(currentOrigin.coords)
      .addTo(map);
  }

  function updateOrigin({ coords, name, type }) {
    currentOrigin = { coords, name, type };
    renderOriginMarker();
  }

  renderOriginMarker();

  // Allow clicking on map to choose a custom location
  map.on("click", (e) => {
    const target = e.originalEvent.target;
    if (
      target &&
      (target.closest(".amenity-pure-marker") ||
        target.closest(".complex-marker") ||
        target.closest(".user-origin-pin") ||
        target.closest(".mapboxgl-popup"))
    ) {
      return;
    }

    const lng = Number(e.lngLat.lng.toFixed(4));
    const lat = Number(e.lngLat.lat.toFixed(4));
    const customLoc = {
      id: "custom",
      coords: [lng, lat],
      name: `Custom Location (${lat}, ${lng})`,
      type: "Pinned Location",
    };

    onLocationPick?.(customLoc);
  });

  function clearPOIs() {
    activeMarkers.forEach((m) => m.remove());
    activeMarkers = [];
  }

  function addPlaceMarker(item, center, profile) {
    const cat = item.cat || {
      color: "#2563eb",
      label: item.categoryId || "Place",
    };

    const el = document.createElement("div");
    el.className = "amenity-pure-marker";
    el.innerHTML = `
      <span class="amenity-pure-dot" style="background-color: ${cat.color};"></span>
      <div class="amenity-pure-label">
        <span class="amenity-pure-name">${item.name}</span>
        <span class="amenity-pure-type" style="color: ${cat.color};">${cat.label}</span>
        ${item.address ? `<span class="amenity-pure-addr">${item.address}</span>` : ""}
      </div>
    `;

    const matchedLines = findLinesForStation(item);
    const isTransport =
      [
        "lrt-station",
        "train-station",
        "bus-station",
        "monorail-station",
        "transit",
      ].includes(item.categoryId || item.cat?.id) ||
      item.cat?.groupId === "transport" ||
      matchedLines.length > 0;

    // Show transit route line on map if the transit label/marker is clicked by the user
    el.addEventListener("click", async () => {
      if (isTransport) {
        await showTransitRouteForStation(item);
      }
    });

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px;">
        <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-bottom: 3px;">${item.name}</strong>
        <span style="display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; background-color: ${cat.color}; margin-bottom: 5px;">${cat.label}</span>
        ${item.address ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">📍 ${item.address}</div>` : ""}
        ${item.cuisine ? `<div style="color: #64748b; font-size: 11.5px; margin-top: 2px;">🍴 Cuisine: ${item.cuisine}</div>` : ""}
        ${isTransport && matchedLines.length ? `<div style="margin-top: 6px; padding: 4px 8px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700;">🚇 Route Line: ${matchedLines.map((l) => l.name).join(", ")} (active on map)</div>` : ""}
      </div>
    `;

    const popup = new mapboxgl.Popup({
      offset: 12,
      closeButton: true,
      maxWidth: "240px",
    }).setHTML(popupHtml);

    popup.on("open", async () => {
      if (isTransport) {
        await showTransitRouteForStation(item);
      }
    });

    const marker = new mapboxgl.Marker({ element: el, anchor: "left" })
      .setLngLat([item.lon, item.lat])
      .setPopup(popup)
      .addTo(map);

    activeMarkers.push(marker);
  }

  function addComplexMarker(cx) {
    const center = cx.bounds.getCenter();
    const el = document.createElement("div");
    el.className = "complex-marker";
    el.title = `${cx.name} (${cx.items.length} places inside)`;
    el.innerHTML = `
      <div class="complex-icon">${cx.items.length}</div>
    `;

    // Group items by floor inside popup, extracting floor from address when missing
    const byFloor = new Map();
    for (const item of cx.items) {
      const k =
        item.floor ||
        floorFromText(item.address) ||
        floorFromText(item.name) ||
        "0";
      item.floor = k;
      if (!byFloor.has(k)) byFloor.set(k, []);
      byFloor.get(k).push(item);
    }
    const floors = [...byFloor.keys()].sort(
      (a, b) => floorOrder(a) - floorOrder(b),
    );

    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px; max-height: 290px; overflow-y: auto;">
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">${cx.name}</strong>
        <div style="color: #0d9488; font-size: 11.5px; font-weight: 700; margin-bottom: 8px;">🏬 ${cx.items.length} places inside complex</div>
        ${floors
          .map(
            (fl) => `
          <div style="font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; margin-top: 6px; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
            ${floorLabel(fl)}
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 6px 0;">
            ${byFloor
              .get(fl)
              .slice(0, 8)
              .map(
                (it) => `
              <li style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: ${it.cat?.color || "#0d9488"}; flex-shrink: 0;"></span>
                <span style="font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.name}</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        `,
          )
          .join("")}
      </div>
    `;

    const popup = new mapboxgl.Popup({
      offset: 14,
      closeButton: true,
      maxWidth: "280px",
    }).setHTML(popupHtml);

    const marker = new mapboxgl.Marker({ element: el, anchor: "left" })
      .setLngLat([center.lng, center.lat])
      .setPopup(popup)
      .addTo(map);

    activeMarkers.push(marker);
  }

  /**
   * Port of app.js renderPlaces with mall/complex clustering and individual POI labeling.
   */
  function renderPlaces(
    { pois, complexes: rawComplexes, source },
    selected,
    centerLat,
    centerLng,
    maxMinutes,
    profile,
  ) {
    clearPOIs();

    const complexes = mergeComplexes(rawComplexes);
    const ownerOf = new Map();
    for (const cx of complexes) for (const k of cx.keys) ownerOf.set(k, cx);

    let items = [];
    for (const poi of pois) {
      // Smallest travel-time band containing the place; skip if beyond the chosen time.
      const band = lastIsoFeatures.find((f) =>
        geometryContains(f.geometry, poi.lon, poi.lat),
      );
      if (!band || (band.properties && band.properties.contour > maxMinutes))
        continue;
      items.push({
        ...poi,
        band: band.properties?.contour ?? maxMinutes,
        point: [poi.lat, poi.lon],
      });
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
        const inside =
          cx.bounds.contains(item.point) &&
          cx.parts.some((r) => polygonContains(r, item.lon, item.lat));
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
        const k = `${item.cat?.id || item.categoryId}|${item.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
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
      const catId = item.cat?.id || item.categoryId || "other";
      const existing = breakdownMap.get(catId) || {
        id: catId,
        label: item.cat?.label || catId,
        color: item.cat?.color || "#2563eb",
        icon: item.cat?.icon || "📍",
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

    const typeBreakdown = Array.from(breakdownMap.values()).sort(
      (a, b) => b.count - a.count,
    );
    const totalCount =
      shown.reduce((n, cx) => n + cx.items.length, 0) + loose.length;
    return {
      total: totalCount,
      shownComplexes: shown.length,
      source,
      typeBreakdown,
    };
  }

  async function showTransitRouteForStation(item) {
    const keyToUse = cleanApiKey(
      googleApiKey ||
        import.meta.env.VITE_GOOGLE_API_KEY ||
        import.meta.env.GOOGLE_API_KEY ||
        "",
    );
    const routeData = await getTransitRouteForStation(item, keyToUse);
    const src = map.getSource("transit-routes");
    if (src) {
      src.setData(routeData);
    }
  }

  async function updateTransitRoutes(geom, categoryIds = []) {
    const isTransitSelected = categoryIds.some((id) =>
      [
        "transport",
        "lrt-station",
        "train-station",
        "bus-station",
        "monorail-station",
        "transit",
      ].includes(id),
    );
    if (!isTransitSelected) {
      const src = map.getSource("transit-routes");
      if (src) src.setData({ type: "FeatureCollection", features: [] });
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
      return;
    }

    updateTransitRoutes(activeIsochroneGeometry, selectedCategoryIds);

    const selectedSet = new Set(selectedCategoryIds);
    if (selectedSet.size === 0) {
      clearPOIs();
      return;
    }

    const selectedCategoryObjects = ALL_CATEGORY_ITEMS.filter((c) =>
      selectedSet.has(c.id),
    );
    const filteredPOIs = lastRawPlacesData.pois.filter((p) =>
      selectedSet.has(p.cat?.id || p.categoryId),
    );
    const filteredData = {
      ...lastRawPlacesData,
      pois: filteredPOIs,
    };

    renderPlaces(
      filteredData,
      selectedCategoryObjects,
      currentOrigin.coords[1],
      currentOrigin.coords[0],
      lastTravelParams.maxMinutes,
      lastTravelParams.profile,
    );
  }

  /**
   * Run Analysis:
   * Exactly ports app.js searchNearby:
   * 1. Fetches isochrone for chosen time and travel method.
   * 2. Fetches chosen amenities using Google Places service.
   * 3. Labels chosen amenities and complexes within that isochrone on the map!
   */
  async function runAnalysis({
    origin,
    mode = "walking",
    minutes = 20,
    selectedCategoryIds = [],
  }) {
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
      throw new Error("No travel-time isochrones returned for this location.");
    }

    lastIsoFeatures = features;
    const target =
      lastIsoFeatures.find((f) => f.properties?.contour === minutes) ||
      lastIsoFeatures[0];
    activeIsochroneGeometry = target.geometry;

    // Apply the single chosen isochrone contour to Mapbox layer
    const source = map.getSource("travel-isochrone");
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [target],
      });
    }

    // Fit map bounds to target isochrone
    const { south, west, north, east, bbox } = getGeojsonBounds(
      activeIsochroneGeometry,
    );
    map.fitBounds(bbox, { padding: 80, duration: 800 });

    // 2. Fetch chosen amenities using Google Map service (Google Places API)
    const selectedSet = new Set(selectedCategoryIds);
    const selectedCategoryObjects = ALL_CATEGORY_ITEMS.filter((c) =>
      selectedSet.has(c.id),
    );

    const keyToUse = cleanApiKey(
      googleApiKey ||
        import.meta.env.VITE_GOOGLE_API_KEY ||
        import.meta.env.GOOGLE_API_KEY ||
        "",
    );

    const cellBounds = new CellBounds(south, west, north, east);
    let data;

    try {
      data = await loadFromGoogle(
        selectedCategoryObjects,
        cellBounds,
        activeIsochroneGeometry,
        keyToUse,
      );
    } catch (err) {
      console.warn("Google Places load failed:", err);
      data = null;
    }

    // If Google Places returned 0 places, fall back to matching places from PLACES_DATA
    if (!data || !data.pois || data.pois.length === 0) {
      const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
      const fallbackPois = PLACES_DATA.filter((p) =>
        selectedSet.has(p.categoryId) && p.coords[1] >= south && p.coords[1] <= north && p.coords[0] >= west && p.coords[0] <= east,
      ).map((p) => {
        const cat = catMap.get(p.categoryId) || {
          id: p.categoryId,
          label: p.categoryId,
          color: "#2563eb",
        };
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
        source: "Local curated places (not live verified)",
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
      mode,
    );

    // Clear any previous transit route lines so the line is shown when clicked by user
    const transitSrc = map.getSource("transit-routes");
    if (transitSrc) {
      transitSrc.setData({ type: "FeatureCollection", features: [] });
    }

    return {
      total: stats.total,
      source: data.source,
      complexes: stats.shownComplexes,
      typeBreakdown: stats.typeBreakdown,
    };
  }

  // Clear isochrone and remove all amenity labels
  function clearIsochrone() {
    isAnalysisActive = false;
    activeIsochroneGeometry = null;
    lastIsoFeatures = [];
    lastRawPlacesData = null;

    const source = map.getSource("travel-isochrone");
    if (source) {
      source.setData({ type: "FeatureCollection", features: [] });
    }

    const transitSrc = map.getSource("transit-routes");
    if (transitSrc) {
      transitSrc.setData({ type: "FeatureCollection", features: [] });
    }

    clearPOIs();
  }

  map.on("load", () => {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
    });

    map.addSource("travel-isochrone", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "travel-isochrone-fill",
      type: "fill",
      source: "travel-isochrone",
      paint: {
        "fill-color": [
          "match",
          ["get", "contour"],
          10,
          ISOCHRONE_COLORS[10],
          20,
          ISOCHRONE_COLORS[20],
          30,
          ISOCHRONE_COLORS[30],
          "#2563eb",
        ],
        "fill-opacity": 0.16,
      },
    });

    map.addLayer({
      id: "travel-isochrone-line",
      type: "line",
      source: "travel-isochrone",
      paint: {
        "line-color": [
          "match",
          ["get", "contour"],
          10,
          ISOCHRONE_COLORS[10],
          20,
          ISOCHRONE_COLORS[20],
          30,
          ISOCHRONE_COLORS[30],
          "#2563eb",
        ],
        "line-width": 2.5,
      },
    });

    // Transit Routes Layer (Visible when transit stations are inside isochrone, extends across KL)
    map.addSource("transit-routes", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "transit-routes-casing",
      type: "line",
      source: "transit-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#0f172a",
        "line-width": 5.5,
        "line-opacity": 0.85,
      },
    });

    map.addLayer({
      id: "transit-routes-line",
      type: "line",
      source: "transit-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.5,
        "line-opacity": 1,
      },
    });

    map.addLayer({
      id: "sky",
      type: "sky",
      layout: {
        visibility: "none",
      },
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0, 90],
        "sky-atmosphere-sun-intensity": 15,
      },
    });

    map.addLayer({
      id: "buildings",
      source: "composite",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 12,
      layout: {
        visibility: "none",
      },
      paint: {
        "fill-extrusion-color": "#cbd5e1",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          0,
          15,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          0,
          15,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.8,
      },
    });

    applyMapView("2d");
    // Ensure map starts clean: NO AMENITIES LABELED AT DEFAULT!
    clearPOIs();
  });

  map.on("error", (event) => {
    console.error("Mapbox error:", event.error);
    const box = errorBoxRef?.current;
    if (box) {
      box.textContent =
        "Map failed to load. Please check your Mapbox token and network access.";
      box.classList.remove("hidden");
    }
  });

  function applyMapView(nextMode) {
    mapMode = nextMode;
    onModeChange?.(nextMode);

    if (mapMode === "2d") {
      map.setTerrain(null);
      if (map.getLayer("buildings")) {
        map.setLayoutProperty("buildings", "visibility", "none");
      }
      if (map.getLayer("sky")) {
        map.setLayoutProperty("sky", "visibility", "none");
      }
      map.flyTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
      return;
    }

    if (map.getLayer("buildings")) {
      map.setLayoutProperty("buildings", "visibility", "visible");
    }
    if (map.getLayer("sky")) {
      map.setLayoutProperty("sky", "visibility", "visible");
    }
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
    map.flyTo({
      pitch: 63,
      bearing: -15,
      duration: 1000,
    });
  }

  function toggleLabels(visible) {
    if (visible) {
      container.classList.remove("hide-amenity-labels");
    } else {
      container.classList.add("hide-amenity-labels");
    }
  }

  return {
    map,
    getMode: () => mapMode,
    applyMapView,
    runAnalysis,
    clearIsochrone,
    updatePOIs,
    updateOrigin,
    toggleLabels,
    flyTo: (coords) => map.flyTo({ center: coords, duration: 800 }),
  };
}
