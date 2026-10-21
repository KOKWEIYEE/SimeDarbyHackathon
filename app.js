/**
 * Feature-Based Architecture Migration
 *
 * The monolithic logic previously in app.js has been modularized into relative feature-based services:
 * - Categories Schema & OSM/Google Types: src/features/map/categories.js
 * - OSM Overpass Service: src/features/map/services/overpassService.js
 * - Google Places Service: src/features/map/services/googlePlacesService.js
 * - Complexes & Spatial Clustering: src/features/map/services/complexesService.js
 * - Geocoding (Nominatim): src/features/map/services/geocodingService.js
 * - Isochrone Service: src/features/map/services/isochroneService.js
 * - Unified Places Search Service: src/features/map/services/placesService.js
 * - Mapbox GL Integration & POI Marker/Label Engine: src/features/map/index.js
 */

export {
  initMapFeature,
  PLACES_DATA,
  PRESET_LOCATIONS,
  ALL_CATEGORY_ITEMS,
  CATEGORY_GROUPS,
  CATEGORIES_BY_ID,
  searchNearbyPlaces,
  searchPlace,
  fetchIsochrones,
} from './src/features/map/index.js';

export {
  fetchOverpass,
  fromOverpass,
  buildOverpassQuery,
  OVERPASS_URLS,
} from './src/features/map/services/overpassService.js';

export {
  loadFromGoogle,
  googleNearby,
  googleCollect,
  GOOGLE_NEARBY_URL,
  GOOGLE_FIELDS,
  GOOGLE_COMPLEX_TYPES,
} from './src/features/map/services/googlePlacesService.js';

export {
  mergeComplexes,
  buildComplex,
  makeComplex,
  complexRings,
  baseName,
  floorKey,
  floorFromText,
  floorLabel,
  floorOrder,
  geometryContains,
  polygonContains,
} from './src/features/map/services/complexesService.js';

export {
  searchPlace as searchNominatim,
  NOMINATIM_URL,
} from './src/features/map/services/geocodingService.js';

export {
  fetchIsochrones as fetchMapboxIsochrones,
  MAPBOX_ISOCHRONE_URL,
  CONTOUR_STYLE,
  MODE_LABEL,
  MINUTES,
} from './src/features/map/services/isochroneService.js';