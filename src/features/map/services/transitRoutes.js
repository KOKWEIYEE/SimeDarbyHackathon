import { geometryContains } from './complexesService.js';

export const TRANSIT_LINES = [
  {
    id: 'lrt-kelana-jaya',
    name: 'LRT Kelana Jaya Line (Line 5)',
    color: '#D8232A',
    stations: [
      { name: 'Gombak', coords: [101.7320, 3.2312] },
      { name: 'Taman Melati', coords: [101.7246, 3.2235] },
      { name: 'Wangsa Maju', coords: [101.7335, 3.2057] },
      { name: 'Sri Rampai', coords: [101.7378, 3.1985] },
      { name: 'Setiawangsa', coords: [101.7380, 3.1755] },
      { name: 'Jelatek', coords: [101.7348, 3.1672] },
      { name: "Dato' Keramat", coords: [101.7315, 3.1652] },
      { name: 'Damai', coords: [101.7240, 3.1645] },
      { name: 'Ampang Park', coords: [101.7195, 3.1598] },
      { name: 'KLCC', coords: [101.7138, 3.1583] },
      { name: 'Kampung Baru', coords: [101.7075, 3.1610] },
      { name: 'Dang Wangi', coords: [101.7028, 3.1575] },
      { name: 'Masjid Jamek', coords: [101.6972, 3.1482] },
      { name: 'Pasar Seni', coords: [101.6962, 3.1440] },
      { name: 'KL Sentral', coords: [101.6862, 3.1340] },
      { name: 'Bangsar', coords: [101.6705, 3.1295] },
      { name: 'Abdullah Hukum', coords: [101.6738, 3.1188] },
      { name: 'Kerinchi', coords: [101.6668, 3.1155] },
      { name: 'Universiti', coords: [101.6618, 3.1142] },
      { name: 'Taman Jaya', coords: [101.6540, 3.1042] },
      { name: 'Asia Jaya', coords: [101.6378, 3.1045] },
      { name: 'Taman Paramount', coords: [101.6230, 3.1070] },
      { name: 'Kelana Jaya', coords: [101.6038, 3.1128] },
    ],
    coordinates: [
      [101.7320, 3.2312],
      [101.7246, 3.2235],
      [101.7335, 3.2057],
      [101.7378, 3.1985],
      [101.7380, 3.1755],
      [101.7348, 3.1672],
      [101.7315, 3.1652],
      [101.7240, 3.1645],
      [101.7195, 3.1598],
      [101.7138, 3.1583],
      [101.7075, 3.1610],
      [101.7028, 3.1575],
      [101.6972, 3.1482],
      [101.6962, 3.1440],
      [101.6862, 3.1340],
      [101.6705, 3.1295],
      [101.6738, 3.1188],
      [101.6668, 3.1155],
      [101.6618, 3.1142],
      [101.6540, 3.1042],
      [101.6378, 3.1045],
      [101.6230, 3.1070],
      [101.6038, 3.1128],
    ],
  },
  {
    id: 'mrt-kajang',
    name: 'MRT Kajang Line (Line 9)',
    color: '#00843D',
    stations: [
      { name: 'Kwasa Damansara', coords: [101.5725, 3.1762] },
      { name: 'Kota Damansara', coords: [101.5790, 3.1508] },
      { name: 'Surian', coords: [101.5935, 3.1495] },
      { name: 'Mutiara Damansara', coords: [101.6085, 3.1558] },
      { name: 'Bandar Utama', coords: [101.6190, 3.1462] },
      { name: 'TTDI', coords: [101.6288, 3.1368] },
      { name: 'Phileo Damansara', coords: [101.6415, 3.1285] },
      { name: 'Pusat Bandar Damansara', coords: [101.6625, 3.1440] },
      { name: 'Semantan', coords: [101.6715, 3.1512] },
      { name: 'Muzium Negara', coords: [101.6893, 3.1440] },
      { name: 'Pasar Seni', coords: [101.6962, 3.1440] },
      { name: 'Merdeka', coords: [101.6975, 3.1452] },
      { name: 'Bukit Bintang', coords: [101.7107, 3.1472] },
      { name: 'Tun Razak Exchange (TRX)', coords: [101.7198, 3.1425] },
      { name: 'Cochrane', coords: [101.7245, 3.1328] },
      { name: 'Maluri', coords: [101.7288, 3.1252] },
      { name: 'Taman Pertama', coords: [101.7328, 3.1128] },
      { name: 'Taman Midah', coords: [101.7360, 3.1035] },
      { name: 'Taman Mutiara', coords: [101.7410, 3.0905] },
      { name: 'Kajang', coords: [101.7915, 2.9825] },
    ],
    coordinates: [
      [101.5725, 3.1762],
      [101.5790, 3.1508],
      [101.5935, 3.1495],
      [101.6085, 3.1558],
      [101.6190, 3.1462],
      [101.6288, 3.1368],
      [101.6415, 3.1285],
      [101.6625, 3.1440],
      [101.6715, 3.1512],
      [101.6893, 3.1440],
      [101.6962, 3.1440],
      [101.6975, 3.1452],
      [101.7107, 3.1472],
      [101.7198, 3.1425],
      [101.7245, 3.1328],
      [101.7288, 3.1252],
      [101.7328, 3.1128],
      [101.7360, 3.1035],
      [101.7410, 3.0905],
      [101.7915, 2.9825],
    ],
  },
  {
    id: 'kl-monorail',
    name: 'KL Monorail (Line 8)',
    color: '#8DC63F',
    stations: [
      { name: 'KL Sentral', coords: [101.6865, 3.1325] },
      { name: 'Tun Sambanthan', coords: [101.6908, 3.1308] },
      { name: 'Maharajalela', coords: [101.6998, 3.1385] },
      { name: 'Hang Tuah', coords: [101.7062, 3.1402] },
      { name: 'Imbi', coords: [101.7100, 3.1450] },
      { name: 'Bukit Bintang', coords: [101.7107, 3.1472] },
      { name: 'Raja Chulan', coords: [101.7132, 3.1510] },
      { name: 'Bukit Nanas', coords: [101.7062, 3.1565] },
      { name: 'Medan Tuanku', coords: [101.6988, 3.1595] },
      { name: 'Chow Kit', coords: [101.6980, 3.1668] },
      { name: 'Titiwangsa', coords: [101.6955, 3.1730] },
    ],
    coordinates: [
      [101.6865, 3.1325],
      [101.6908, 3.1308],
      [101.6998, 3.1385],
      [101.7062, 3.1402],
      [101.7100, 3.1450],
      [101.7107, 3.1472],
      [101.7132, 3.1510],
      [101.7062, 3.1565],
      [101.6988, 3.1595],
      [101.6980, 3.1668],
      [101.6955, 3.1730],
    ],
  },
  {
    id: 'lrt-ampang-line',
    name: 'LRT Ampang & Sri Petaling (Lines 3 & 4)',
    color: '#F58220',
    stations: [
      { name: 'Sentul Timur', coords: [101.6950, 3.1860] },
      { name: 'Sentul', coords: [101.6948, 3.1785] },
      { name: 'Titiwangsa', coords: [101.6955, 3.1730] },
      { name: 'PWTC', coords: [101.6940, 3.1668] },
      { name: 'Sultan Ismail', coords: [101.6960, 3.1595] },
      { name: 'Bandaraya', coords: [101.6945, 3.1528] },
      { name: 'Masjid Jamek', coords: [101.6972, 3.1482] },
      { name: 'Plaza Rakyat', coords: [101.7018, 3.1445] },
      { name: 'Hang Tuah', coords: [101.7062, 3.1402] },
      { name: 'Pudu', coords: [101.7125, 3.1360] },
      { name: 'Chan Sow Lin', coords: [101.7118, 3.1285] },
      { name: 'Miharja', coords: [101.7212, 3.1228] },
      { name: 'Maluri', coords: [101.7288, 3.1252] },
    ],
    coordinates: [
      [101.6950, 3.1860],
      [101.6948, 3.1785],
      [101.6955, 3.1730],
      [101.6940, 3.1668],
      [101.6960, 3.1595],
      [101.6945, 3.1528],
      [101.6972, 3.1482],
      [101.7018, 3.1445],
      [101.7062, 3.1402],
      [101.7125, 3.1360],
      [101.7118, 3.1285],
      [101.7212, 3.1228],
      [101.7288, 3.1252],
    ],
  },
  {
    id: 'mrt-putrajaya',
    name: 'MRT Putrajaya Line (Line 12)',
    color: '#FFCD00',
    stations: [
      { name: 'Kwasa Damansara', coords: [101.5725, 3.1762] },
      { name: 'Kampung Batu', coords: [101.6815, 3.2045] },
      { name: 'Kentonmen', coords: [101.6820, 3.1950] },
      { name: 'Jalan Ipoh', coords: [101.6865, 3.1840] },
      { name: 'Sentul Barat', coords: [101.6890, 3.1770] },
      { name: 'Titiwangsa', coords: [101.6955, 3.1730] },
      { name: 'Hospital Kuala Lumpur', coords: [101.7025, 3.1720] },
      { name: 'Raja Uda', coords: [101.7088, 3.1668] },
      { name: 'Ampang Park', coords: [101.7195, 3.1598] },
      { name: 'Persiaran KLCC', coords: [101.7175, 3.1535] },
      { name: 'Conlay', coords: [101.7170, 3.1495] },
      { name: 'Tun Razak Exchange (TRX)', coords: [101.7198, 3.1425] },
      { name: 'Chan Sow Lin', coords: [101.7118, 3.1285] },
    ],
    coordinates: [
      [101.5725, 3.1762],
      [101.6815, 3.2045],
      [101.6820, 3.1950],
      [101.6865, 3.1840],
      [101.6890, 3.1770],
      [101.6955, 3.1730],
      [101.7025, 3.1720],
      [101.7088, 3.1668],
      [101.7195, 3.1598],
      [101.7175, 3.1535],
      [101.7170, 3.1495],
      [101.7198, 3.1425],
      [101.7118, 3.1285],
    ],
  },
  {
    id: 'ktm-komuter',
    name: 'KTM Komuter Line (Line 1/2)',
    color: '#0284c7',
    stations: [
      { name: 'Batu Caves', coords: [101.6815, 3.2370] },
      { name: 'Taman Wahyu', coords: [101.6740, 3.2180] },
      { name: 'Kampung Batu', coords: [101.6815, 3.2045] },
      { name: 'Batu Kentonmen', coords: [101.6820, 3.1950] },
      { name: 'Sentul', coords: [101.6910, 3.1785] },
      { name: 'Putra', coords: [101.6925, 3.1670] },
      { name: 'Bank Negara', coords: [101.6930, 3.1550] },
      { name: 'Kuala Lumpur', coords: [101.6935, 3.1395] },
      { name: 'KL Sentral', coords: [101.6865, 3.1342] },
      { name: 'Mid Valley', coords: [101.6765, 3.1180] },
      { name: 'Seputeh', coords: [101.6810, 3.1110] },
      { name: 'Salak Selatan', coords: [101.7040, 3.0980] },
      { name: 'Bandar Tasik Selatan', coords: [101.7110, 3.0760] },
    ],
    coordinates: [
      [101.6815, 3.2370],
      [101.6740, 3.2180],
      [101.6815, 3.2045],
      [101.6820, 3.1950],
      [101.6910, 3.1785],
      [101.6925, 3.1670],
      [101.6930, 3.1550],
      [101.6935, 3.1395],
      [101.6865, 3.1342],
      [101.6765, 3.1180],
      [101.6810, 3.1110],
      [101.7040, 3.0980],
      [101.7110, 3.0760],
    ],
  },
];

export function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lng * 1e-5, lat * 1e-5]);
  }
  return points;
}

/**
 * Given an isochrone geometry and the transit selection flag:
 * Returns GeoJSON FeatureCollection of transit routes that have at least
 * one station located within the isochrone area.
 * The full route geometry extends beyond the isochrone!
 */
export function getActiveTransitRoutes(isochroneGeometry, isTransitSelected = false) {
  if (!isTransitSelected || !isochroneGeometry) {
    return { type: 'FeatureCollection', features: [] };
  }

  const activeFeatures = [];

  for (const line of TRANSIT_LINES) {
    // Check if any station on this line falls within the isochrone
    const hasStationInside = line.stations.some((st) =>
      geometryContains(isochroneGeometry, st.coords[0], st.coords[1])
    );

    if (hasStationInside) {
      // Add the entire connected line feature (exceeding isochrone)
      activeFeatures.push({
        type: 'Feature',
        id: line.id,
        properties: {
          id: line.id,
          name: line.name,
          color: line.color,
          source: 'mapbox',
        },
        geometry: {
          type: 'LineString',
          coordinates: line.coordinates,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features: activeFeatures,
  };
}

/**
 * Query Google Routes / Directions service first for transit route geometry.
 * If unavailable, throttled, or failed, seamlessly fall back to Mapbox transit route layer.
 */
export async function getActiveTransitRoutesWithGoogleFirst(isochroneGeometry, isTransitSelected = false, googleApiKey = '') {
  if (!isTransitSelected || !isochroneGeometry) {
    return { type: 'FeatureCollection', features: [] };
  }

  const activeLines = TRANSIT_LINES.filter((line) =>
    line.stations.some((st) => geometryContains(isochroneGeometry, st.coords[0], st.coords[1]))
  );

  if (!activeLines.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  if (true) {
    try {
      const googleFeatures = [];
      for (const line of activeLines) {
        try {
          const firstSt = line.stations[0];
          const lastSt = line.stations[line.stations.length - 1];
          const res = await fetch('/api/routes/transit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: firstSt.coords[1], longitude: firstSt.coords[0] } } },
              destination: { location: { latLng: { latitude: lastSt.coords[1], longitude: lastSt.coords[0] } } },
              travelMode: 'TRANSIT',
              fieldMask: 'routes.polyline.encodedPolyline',
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const poly = data.routes?.[0]?.polyline?.encodedPolyline;
            if (poly) {
              const coords = decodePolyline(poly);
              if (coords.length > 1) {
                googleFeatures.push({
                  type: 'Feature',
                  id: line.id,
                  properties: { id: line.id, name: line.name, color: line.color, source: 'google' },
                  geometry: { type: 'LineString', coordinates: coords },
                });
                continue;
              }
            }
          }
        } catch {
          // ignore single line route error
        }

        // Line-level fallback to Mapbox coordinates
        googleFeatures.push({
          type: 'Feature',
          id: line.id,
          properties: { id: line.id, name: line.name, color: line.color, source: 'mapbox' },
          geometry: { type: 'LineString', coordinates: line.coordinates },
        });
      }

      if (googleFeatures.length > 0) {
        return {
          type: 'FeatureCollection',
          features: googleFeatures,
        };
      }
    } catch (err) {
      console.warn('Google Maps transit service error, falling back to Mapbox service:', err);
    }
  }

  // Fallback to Mapbox service
  return getActiveTransitRoutes(isochroneGeometry, isTransitSelected);
}

/**
 * Strictly checks whether an item is a genuine train / rail / transit station.
 * Bus stops, bus terminals, and all non-transit places return false.
 */
export function isTransportStation(item) {
  if (!item) return false;
  const catId = item.categoryId || item.cat?.id || '';
  const groupId = item.cat?.groupId || '';

  // Rail transit stations:
  if (['lrt-station', 'train-station', 'monorail-station'].includes(catId)) {
    return true;
  }

  // Bus stations or bus stops do NOT have rail transit routes
  if (catId === 'bus-station' || (item.name || '').toLowerCase().includes('bus')) {
    return false;
  }

  if (Array.isArray(item.types)) {
    const isRail = item.types.some((t) =>
      ['subway_station', 'light_rail_station', 'train_station'].includes(t)
    );
    if (isRail) return true;
  }

  const name = (item.name || '').toLowerCase();
  const hasRailKeyword =
    name.includes('lrt') ||
    name.includes('mrt') ||
    name.includes('monorail') ||
    name.includes('ktm') ||
    name.includes('komuter') ||
    name.includes('transit hub');

  return hasRailKeyword;
}

export function cleanStationName(str) {
  return (str || '')
    .toLowerCase()
    .replace(/stesen\s+/g, '')
    .replace(/\s+station/g, '')
    .replace(/\s+stn/g, '')
    .replace(/\s+lrt/g, '')
    .replace(/\s+mrt/g, '')
    .replace(/\s+monorail/g, '')
    .replace(/\s+ktm/g, '')
    .replace(/transport\s+hub/g, '')
    .replace(/komuter/g, '')
    .replace(/rapidkl/g, '')
    .replace(/[()&,/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns ONLY the transit route line(s) that a transport station genuinely belongs to.
 * Non-transport items and bus stops return empty array!
 */
export function findLinesForStation(item) {
  if (!isTransportStation(item)) {
    return [];
  }

  const rawName = (item.name || '').toLowerCase();
  const cleanName = cleanStationName(rawName);
  const coords = item.coords || [item.lon, item.lat] || [0, 0];
  const lng = coords[0];
  const lat = coords[1];

  const matched = [];

  const isExplicitMonorail = rawName.includes('monorail') || item.categoryId === 'monorail-station';
  const isExplicitMrt = rawName.includes('mrt');
  const isExplicitLrt = rawName.includes('lrt');
  const isExplicitKtm = rawName.includes('ktm') || rawName.includes('komuter');

  for (const line of TRANSIT_LINES) {
    // Mode constraints
    if (isExplicitMonorail && line.id !== 'kl-monorail') {
      continue;
    }
    if (isExplicitMrt && !line.id.startsWith('mrt-') && !rawName.includes('interchange') && !rawName.includes('hub')) {
      continue;
    }
    if (isExplicitKtm && line.id !== 'ktm-komuter' && !rawName.includes('hub') && !rawName.includes('sentral')) {
      continue;
    }

    // Check station names on this line
    for (const st of line.stations) {
      const stClean = cleanStationName(st.name);

      const exactMatch =
        cleanName === stClean ||
        (cleanName.length >= 4 && (cleanName.includes(stClean) || stClean.includes(cleanName)));

      const isTrx =
        (cleanName.includes('trx') || cleanName.includes('tun razak exchange')) &&
        (stClean.includes('trx') || stClean.includes('tun razak exchange'));

      if (exactMatch || isTrx) {
        if (lng && lat && st.coords) {
          const dLng = st.coords[0] - lng;
          const dLat = st.coords[1] - lat;
          const distSq = dLng * dLng + dLat * dLat;
          if (distSq < 0.0003) {
            if (!matched.some((m) => m.id === line.id)) {
              matched.push(line);
            }
            break;
          }
        } else {
          if (!matched.some((m) => m.id === line.id)) {
            matched.push(line);
          }
          break;
        }
      }
    }
  }

  // Fallback for unnamed / OSM stations strictly within ~150 meters
  if (!matched.length && lng && lat) {
    for (const line of TRANSIT_LINES) {
      for (const st of line.stations) {
        const dLng = st.coords[0] - lng;
        const dLat = st.coords[1] - lat;
        const distSq = dLng * dLng + dLat * dLat;
        if (distSq < 0.000004) {
          if (!matched.some((m) => m.id === line.id)) {
            matched.push(line);
          }
        }
      }
    }
  }

  return matched;
}

/**
 * Returns transit route lines specifically for a clicked station.
 * ONLY returns routes if item is a transport station and belongs to the line.
 */
export async function getTransitRouteForStation(stationItem) {
  if (!isTransportStation(stationItem)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const lines = findLinesForStation(stationItem);
  if (!lines.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: lines.map((line) => ({
      type: 'Feature',
      id: line.id,
      properties: {
        id: line.id,
        name: line.name,
        color: line.color,
        source: 'mapbox',
      },
      geometry: {
        type: 'LineString',
        coordinates: line.coordinates,
      },
    })),
  };
}
