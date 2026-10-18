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
];

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
