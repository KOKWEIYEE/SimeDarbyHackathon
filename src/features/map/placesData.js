export { CATEGORY_GROUPS, ALL_CATEGORY_ITEMS, CATEGORIES_BY_ID } from './categories.js';


export const PRESET_LOCATIONS = [
  { id: 'sime-darby', name: 'Sime Darby Centre', coords: [101.7069, 3.1390], type: 'Commercial HQ' },
  { id: 'pavilion', name: 'Pavilion Kuala Lumpur', coords: [101.7134, 3.1488], type: 'Retail & Shopping' },
  { id: 'klcc', name: 'Suria KLCC / Petronas Towers', coords: [101.7118, 3.1578], type: 'Commercial & Landmark' },
  { id: 'trx', name: 'The Exchange TRX', coords: [101.7187, 3.1432], type: 'Financial District' },
  { id: 'bukit-bintang', name: 'Bukit Bintang Station', coords: [101.7107, 3.1472], type: 'Transit Interchange' },
  { id: 'kl-sentral', name: 'KL Sentral Transport Hub', coords: [101.6865, 3.1342], type: 'Multimodal Transit' },
];

export const PLACES_DATA = [
  // ── SHOPPING MALLS ──────────────────────────────────────────────
  { id: 'mall-1',  name: 'Pavilion Kuala Lumpur',        categoryId: 'mall', coords: [101.7134, 3.1488], address: '168 Jalan Bukit Bintang' },
  { id: 'mall-2',  name: 'Suria KLCC',                   categoryId: 'mall', coords: [101.7118, 3.1578], address: '241 Jalan Ampang, KLCC' },
  { id: 'mall-3',  name: 'The Exchange TRX',              categoryId: 'mall', coords: [101.7187, 3.1432], address: 'Persiaran TRX, Imbi' },
  { id: 'mall-4',  name: 'Berjaya Times Square',          categoryId: 'mall', coords: [101.7100, 3.1422], address: '1 Jalan Imbi' },
  { id: 'mall-5',  name: 'Lot 10 Shopping Centre',        categoryId: 'mall', coords: [101.7122, 3.1480], address: '50 Jalan Sultan Ismail' },
  { id: 'mall-6',  name: 'Starhill Gallery',              categoryId: 'mall', coords: [101.7130, 3.1480], address: '181 Jalan Bukit Bintang' },
  { id: 'mall-7',  name: 'Fahrenheit 88',                 categoryId: 'mall', coords: [101.7124, 3.1477], address: '179 Jalan Bukit Bintang' },
  { id: 'mall-8',  name: 'MyTOWN Shopping Centre',        categoryId: 'mall', coords: [101.7230, 3.1345], address: '6 Jalan Cochrane' },
  { id: 'mall-9',  name: 'Sunway Velocity Mall',          categoryId: 'mall', coords: [101.7248, 3.1285], address: 'Persiaran Velocity, Cheras' },
  { id: 'mall-10', name: 'Quill City Mall KL',            categoryId: 'mall', coords: [101.7053, 3.1590], address: '1018 Jalan Sultan Ismail' },
  { id: 'mall-11', name: 'Avenue K',                      categoryId: 'mall', coords: [101.7105, 3.1570], address: '156 Jalan Ampang, KLCC' },
  { id: 'mall-12', name: 'Nu Sentral',                    categoryId: 'mall', coords: [101.6865, 3.1342], address: 'Jalan Stesen Sentral 5, Brickfields' },
  { id: 'mall-13', name: 'Mid Valley Megamall',           categoryId: 'mall', coords: [101.6765, 3.1178], address: 'Mid Valley City, Lingkaran Syed Putra' },
  { id: 'mall-14', name: 'The Gardens Mall',              categoryId: 'mall', coords: [101.6771, 3.1185], address: 'Mid Valley City, Lingkaran Syed Putra' },
  { id: 'mall-15', name: 'Bangsar Village II',            categoryId: 'mall', coords: [101.6712, 3.1303], address: '2 Jalan Telawi 1, Bangsar' },
  { id: 'mall-16', name: 'Publika Shopping Gallery',      categoryId: 'mall', coords: [101.6666, 3.1653], address: 'Solaris Dutamas, Jalan Dutamas 1' },
  { id: 'mall-17', name: 'Plaza Low Yat',                 categoryId: 'mall', coords: [101.7108, 3.1453], address: 'Jalan Bukit Bintang, Bukit Bintang' },
  { id: 'mall-18', name: 'Wangsa Walk Mall',              categoryId: 'mall', coords: [101.7438, 3.1955], address: 'Jalan Wangsa Delima 6, Wangsa Maju' },

  // ── GROCERY / SUPERMARKET ────────────────────────────────────────
  { id: 'groc-1',  name: 'Mercato Pavilion KL',           categoryId: 'grocery', coords: [101.7130, 3.1485], address: 'Concourse Floor, Pavilion KL' },
  { id: 'groc-2',  name: 'Village Grocer MyTOWN',         categoryId: 'grocery', coords: [101.7232, 3.1348], address: 'B1 MyTOWN Shopping Centre' },
  { id: 'groc-3',  name: 'Jaya Grocer KLCC',              categoryId: 'grocery', coords: [101.7105, 3.1572], address: 'Suria KLCC, Level 1' },
  { id: 'groc-4',  name: "Cold Storage Starhill",         categoryId: 'grocery', coords: [101.7128, 3.1482], address: 'Starhill Gallery, Level LG' },
  { id: 'groc-5',  name: "Ben's Independent Grocer TRX",  categoryId: 'grocery', coords: [101.7188, 3.1430], address: 'The Exchange TRX, B2' },
  { id: 'groc-6',  name: "Lotus's Cheras",                categoryId: 'grocery', coords: [101.7291, 3.1258], address: 'Jalan Cheras, Cheras' },
  { id: 'groc-7',  name: 'Giant Supermarket Cheras',      categoryId: 'grocery', coords: [101.7305, 3.1220], address: 'Jalan Cheras, Taman Miharja' },
  { id: 'groc-8',  name: 'Econsave Pudu Ulu',             categoryId: 'grocery', coords: [101.7140, 3.1358], address: 'Jalan Pudu Ulu, Pudu' },
  { id: 'groc-9',  name: 'Village Grocer Bangsar',        categoryId: 'grocery', coords: [101.6712, 3.1305], address: 'Bangsar Village II' },
  { id: 'groc-10', name: 'Hock Choon Supermarket',        categoryId: 'grocery', coords: [101.7238, 3.1572], address: 'Jalan Ampang, Ampang' },

  // ── RESTAURANTS ──────────────────────────────────────────────────
  { id: 'rest-1',  name: 'Din Tai Fung Pavilion',         categoryId: 'restaurant', coords: [101.7135, 3.1490], address: 'Level 6, Pavilion KL' },
  { id: 'rest-2',  name: 'Jalan Alor Night Food Street',  categoryId: 'restaurant', coords: [101.7087, 3.1460], address: 'Jalan Alor, Bukit Bintang' },
  { id: 'rest-3',  name: 'Nasi Kandar Pelita KLCC',       categoryId: 'restaurant', coords: [101.7132, 3.1562], address: '149 Jalan Ampang, KLCC' },
  { id: 'rest-4',  name: 'PAUL Bakery & Restaurant KLCC', categoryId: 'restaurant', coords: [101.7115, 3.1577], address: 'Suria KLCC, Level 2' },
  { id: 'rest-5',  name: 'Bunn Chow Bukit Bintang',       categoryId: 'restaurant', coords: [101.7095, 3.1458], address: 'Jalan Berangan, Bukit Bintang' },
  { id: 'rest-6',  name: 'Fuego Restaurant at TRX',       categoryId: 'restaurant', coords: [101.7190, 3.1428], address: 'The Exchange TRX, Level 5' },
  { id: 'rest-7',  name: "Madam Kwan's KLCC",             categoryId: 'restaurant', coords: [101.7116, 3.1574], address: 'Suria KLCC, Level 4' },
  { id: 'rest-8',  name: 'Limapulo KL',                   categoryId: 'restaurant', coords: [101.7024, 3.1488], address: '50 Jalan Doraisamy, Dang Wangi' },
  { id: 'rest-9',  name: 'Enak KL Malay Fine Dining',     categoryId: 'restaurant', coords: [101.7128, 3.1482], address: 'Feast Floor, Starhill Gallery' },
  { id: 'rest-10', name: 'Imbi Market (Pasar Imbi)',      categoryId: 'restaurant', coords: [101.7092, 3.1440], address: 'Jalan Imbi, Imbi' },
  { id: 'rest-11', name: 'Yut Kee Restaurant',            categoryId: 'restaurant', coords: [101.6992, 3.1568], address: '35 Jalan Dang Wangi, Chow Kit' },
  { id: 'rest-12', name: 'Old China Cafe',                categoryId: 'restaurant', coords: [101.6996, 3.1468], address: '11 Jalan Balai Polis, Chinatown' },
  { id: 'rest-13', name: 'Hawker Chan KL',                categoryId: 'restaurant', coords: [101.7108, 3.1430], address: 'Lot 10, Jalan Sultan Ismail' },
  { id: 'rest-14', name: 'Manhattan Fish Market Pavilion',categoryId: 'restaurant', coords: [101.7136, 3.1487], address: 'Level 6, Pavilion KL' },
  { id: 'rest-15', name: 'Penang Delights Jln Alor',      categoryId: 'restaurant', coords: [101.7083, 3.1464], address: 'Jalan Alor, Bukit Bintang' },
  { id: 'rest-16', name: 'Village Park Nasi Lemak',       categoryId: 'restaurant', coords: [101.7102, 3.1435], address: 'Jalan Imbi, KL' },
  { id: 'rest-17', name: 'Brasserie 25 Ritz-Carlton KL',  categoryId: 'restaurant', coords: [101.7145, 3.1471], address: 'The Ritz-Carlton KL, Jalan Imbi' },
  { id: 'rest-18', name: 'Nathalie Gourmet Studio',       categoryId: 'restaurant', coords: [101.7055, 3.1547], address: '31 Jalan Berangan, Bukit Bintang' },
  { id: 'rest-19', name: 'Kikubari Japanese Fine Dining', categoryId: 'restaurant', coords: [101.7134, 3.1482], address: 'Prince Hotel Kuala Lumpur' },
  { id: 'rest-20', name: 'Fong Lye Taiwanese KLCC',       categoryId: 'restaurant', coords: [101.7120, 3.1568], address: 'Avenue K, KLCC' },
  { id: 'rest-21', name: 'Nasi Lemak Wanjo Bangsar',      categoryId: 'restaurant', coords: [101.6715, 3.1315], address: 'Jalan Telawi, Bangsar' },
  { id: 'rest-22', name: 'Ikan Bakar Jalan Ipoh',         categoryId: 'restaurant', coords: [101.6890, 3.1680], address: 'Jalan Ipoh, KL' },
  { id: 'rest-23', name: 'Restoran Batu Caves Bah Kut Teh',categoryId: 'restaurant', coords: [101.6858, 3.2370], address: 'Batu Caves, Gombak' },
  { id: 'rest-24', name: 'Sek Yuen Restaurant',           categoryId: 'restaurant', coords: [101.7105, 3.1390], address: 'Jalan Pudu, Pudu' },
  { id: 'rest-25', name: 'Kim Lian Kee Hokkien Mee',      categoryId: 'restaurant', coords: [101.7082, 3.1462], address: 'Jalan Alor, Bukit Bintang' },
  { id: 'rest-26', name: 'Opium TRX',                     categoryId: 'restaurant', coords: [101.7188, 3.1445], address: 'TRX, KL' },
  { id: 'rest-27', name: 'Iketeru Japanese Restaurant KL',categoryId: 'restaurant', coords: [101.7049, 3.1555], address: 'Hilton KL, Jalan Stesen Sentral 5' },
  { id: 'rest-28', name: 'Lai Ching Yuen Mid Valley',     categoryId: 'restaurant', coords: [101.6768, 3.1182], address: 'Grand Millennium KL, Mid Valley' },
  { id: 'rest-29', name: 'Bijan Bar Restaurant',          categoryId: 'restaurant', coords: [101.7062, 3.1527], address: '3 Jalan Ceylon, Bukit Bintang' },
  { id: 'rest-30', name: 'Acme Bar & Coffee KL',          categoryId: 'restaurant', coords: [101.7085, 3.1530], address: '10 Lorong Ceylon, Bukit Bintang' },

  // ── CAFES ────────────────────────────────────────────────────────
  { id: 'cafe-1',  name: 'VCR Cafe Pudu',                 categoryId: 'cafe', coords: [101.7065, 3.1415], address: '2 Jalan Galloway, Bukit Bintang' },
  { id: 'cafe-2',  name: 'Feeka Coffee Roasters',          categoryId: 'cafe', coords: [101.7088, 3.1505], address: '19 Jalan Mesui, Bukit Bintang' },
  { id: 'cafe-3',  name: 'Pulp by Papa Palheta',          categoryId: 'cafe', coords: [101.7002, 3.1490], address: 'Medan Pasar Lama, City Centre' },
  { id: 'cafe-4',  name: 'Artisan Roast KL',              categoryId: 'cafe', coords: [101.6952, 3.1575], address: 'Jalan Doraisamy, Dang Wangi' },
  { id: 'cafe-5',  name: 'Three Little Birds Cafe',       categoryId: 'cafe', coords: [101.7080, 3.1510], address: 'Jalan Mesui, Bukit Bintang' },
  { id: 'cafe-6',  name: 'Brew Culture Coffee',           categoryId: 'cafe', coords: [101.7072, 3.1520], address: 'Jalan Bukit Bintang, KL' },
  { id: 'cafe-7',  name: 'OldTown White Coffee KLCC',     categoryId: 'cafe', coords: [101.7108, 3.1573], address: 'Avenue K, Ampang, KLCC' },
  { id: 'cafe-8',  name: 'Starbucks Pavilion KL',         categoryId: 'cafe', coords: [101.7138, 3.1492], address: 'Level 1, Pavilion KL' },
  { id: 'cafe-9',  name: 'Starbucks The Exchange TRX',    categoryId: 'cafe', coords: [101.7183, 3.1433], address: 'The Exchange TRX, KL' },
  { id: 'cafe-10', name: 'ZUS Coffee Bukit Bintang',      categoryId: 'cafe', coords: [101.7099, 3.1475], address: 'Jalan Bukit Bintang, KL' },
  { id: 'cafe-11', name: 'Gigi Coffee Bangsar',           categoryId: 'cafe', coords: [101.6720, 3.1298], address: 'Jalan Telawi, Bangsar' },
  { id: 'cafe-12', name: 'Merchant Lane KL',              categoryId: 'cafe', coords: [101.6994, 3.1468], address: '150 Jalan Petaling, Chinatown' },
  { id: 'cafe-13', name: 'WhiteAways Cafe',               categoryId: 'cafe', coords: [101.6972, 3.1565], address: 'Jalan Doraisamy, Dang Wangi' },
  { id: 'cafe-14', name: 'Doo Wop Coffee Imbi',           categoryId: 'cafe', coords: [101.7103, 3.1440], address: 'Jalan Imbi, KL' },
  { id: 'cafe-15', name: 'Nook Cafe KLCC',                categoryId: 'cafe', coords: [101.7112, 3.1565], address: 'Jalan Ampang, KLCC' },
  { id: 'cafe-16', name: 'Common Man Coffee Roasters',    categoryId: 'cafe', coords: [101.7108, 3.1540], address: 'Jalan Raja Chulan, KL' },
  { id: 'cafe-17', name: 'Coffee Stain Bangsar',          categoryId: 'cafe', coords: [101.6718, 3.1302], address: 'Jalan Telawi, Bangsar' },
  { id: 'cafe-18', name: 'Coffea Coffee Bukit Bintang',   categoryId: 'cafe', coords: [101.7094, 3.1460], address: 'Jalan Bukit Bintang, KL' },

  // ── BARS ─────────────────────────────────────────────────────────
  { id: 'bar-1',  name: "Marini's on 57",                 categoryId: 'bar', coords: [101.7125, 3.1572], address: 'Petronas Tower 3, Level 57' },
  { id: 'bar-2',  name: 'Troika Sky Dining',              categoryId: 'bar', coords: [101.7150, 3.1593], address: 'Persiaran KLCC, KL' },
  { id: 'bar-3',  name: 'SkyBar Traders Hotel',           categoryId: 'bar', coords: [101.7112, 3.1570], address: 'Traders Hotel KL, Level 33' },
  { id: 'bar-4',  name: 'Luna Bar KLCC',                  categoryId: 'bar', coords: [101.7105, 3.1558], address: 'Pacific Regency Hotel, Level 34' },
  { id: 'bar-5',  name: 'Heli Lounge Bar KL',             categoryId: 'bar', coords: [101.7066, 3.1555], address: 'Menara KH, Level 34' },
  { id: 'bar-6',  name: 'Pisco Bar Bukit Bintang',        categoryId: 'bar', coords: [101.7092, 3.1497], address: 'Jalan Mesui, Bukit Bintang' },
  { id: 'bar-7',  name: 'Taps Beer Bar KL',               categoryId: 'bar', coords: [101.7082, 3.1510], address: 'Jalan Mesui, Bukit Bintang' },
  { id: 'bar-8',  name: 'PS150 Chinatown',                categoryId: 'bar', coords: [101.6982, 3.1465], address: '150 Jalan Petaling, Chinatown' },
  { id: 'bar-9',  name: 'The Sarang Bar KL',              categoryId: 'bar', coords: [101.7078, 3.1495], address: 'Jalan Mesui, Bukit Bintang' },
  { id: 'bar-10', name: 'Coley Cocktail Bar',             categoryId: 'bar', coords: [101.7032, 3.1492], address: 'Jalan Abdullah, Bangsar' },

  // ── PARKS & RECREATION ───────────────────────────────────────────
  { id: 'park-1',  name: 'KLCC Park',                     categoryId: 'park', coords: [101.7144, 3.1550], address: 'KLCC, Kuala Lumpur' },
  { id: 'park-2',  name: 'KL Forest Eco Park',            categoryId: 'park', coords: [101.7025, 3.1510], address: 'Lot 240, Jalan Raja Chulan' },
  { id: 'park-3',  name: 'Perdana Botanical Garden',      categoryId: 'park', coords: [101.6880, 3.1472], address: 'Jalan Kebun Bunga, Lake Gardens' },
  { id: 'park-4',  name: 'Titiwangsa Lake Gardens',       categoryId: 'park', coords: [101.7063, 3.1750], address: 'Jalan Kuantan, Titiwangsa' },
  { id: 'park-5',  name: 'Bukit Aman Reservoir Garden',   categoryId: 'park', coords: [101.6905, 3.1500], address: 'Jalan Parlimen, City Centre' },
  { id: 'park-6',  name: 'Kepong Metropolitan Park',      categoryId: 'park', coords: [101.6355, 3.2065], address: 'Kepong, Kuala Lumpur' },
  { id: 'park-7',  name: 'Kiara Park Mont Kiara',         categoryId: 'park', coords: [101.6570, 3.1630], address: 'Bukit Kiara, Mont Kiara' },
  { id: 'park-8',  name: 'Chow Kit Garden',               categoryId: 'park', coords: [101.6998, 3.1638], address: 'Jalan Chow Kit, Chow Kit' },

  // ── GYMS ─────────────────────────────────────────────────────────
  { id: 'gym-1',  name: 'Fitness First Platinum Pavilion', categoryId: 'gym', coords: [101.7125, 3.1485], address: 'Level 8, Pavilion KL' },
  { id: 'gym-2',  name: 'True Fitness KLCC',               categoryId: 'gym', coords: [101.7108, 3.1575], address: 'Suria KLCC, Level 3' },
  { id: 'gym-3',  name: 'Celebrity Fitness Berjaya Times', categoryId: 'gym', coords: [101.7102, 3.1425], address: 'Level 8, Berjaya Times Square' },
  { id: 'gym-4',  name: 'Anytime Fitness Jln Imbi',       categoryId: 'gym', coords: [101.7107, 3.1440], address: 'Jalan Imbi, KL' },
  { id: 'gym-5',  name: 'Anytime Fitness Jln Ampang',     categoryId: 'gym', coords: [101.7192, 3.1545], address: 'Jalan Ampang, KL' },
  { id: 'gym-6',  name: 'F45 Training Bangsar',           categoryId: 'gym', coords: [101.6720, 3.1305], address: 'Jalan Telawi, Bangsar' },

  // ── CINEMAS ──────────────────────────────────────────────────────
  { id: 'mov-1',  name: 'TGV Cinemas Sunway Velocity',    categoryId: 'movie', coords: [101.7248, 3.1285], address: 'Level 4, Sunway Velocity Mall' },
  { id: 'mov-2',  name: 'GSC Pavilion KL',                categoryId: 'movie', coords: [101.7138, 3.1490], address: 'Level 7, Pavilion KL' },
  { id: 'mov-3',  name: 'GSC Mid Valley',                 categoryId: 'movie', coords: [101.6770, 3.1183], address: 'Mid Valley Megamall, Level 3' },
  { id: 'mov-4',  name: 'TGV Berjaya Times Square',       categoryId: 'movie', coords: [101.7100, 3.1422], address: 'Level 11, Berjaya Times Square' },

  // ── ART & CULTURE ────────────────────────────────────────────────
  { id: 'art-1',  name: 'Ilham Gallery',                  categoryId: 'art', coords: [101.7180, 3.1585], address: 'Levels 3 & 5, Ilham Tower, Jalan Binjai' },
  { id: 'art-2',  name: 'Wei-Ling Gallery',               categoryId: 'art', coords: [101.6865, 3.1335], address: 'Brickfields, Kuala Lumpur' },
  { id: 'art-3',  name: 'Segaris Art Center',             categoryId: 'art', coords: [101.6665, 3.1652], address: 'Publika, Solaris Dutamas' },
  { id: 'art-4',  name: 'Galeri Petronas',                categoryId: 'art', coords: [101.7112, 3.1578], address: 'Suria KLCC, Level 3' },
  { id: 'art-5',  name: 'NN Gallery Bangsar',             categoryId: 'art', coords: [101.6720, 3.1300], address: 'Jalan Telawi, Bangsar' },

  // ── MUSEUMS ──────────────────────────────────────────────────────
  { id: 'mus-1',  name: 'National Museum (Muzium Negara)', categoryId: 'museum', coords: [101.6893, 3.1440], address: 'Jalan Damansara, Lake Gardens' },
  { id: 'mus-2',  name: 'Islamic Arts Museum Malaysia',   categoryId: 'museum', coords: [101.6875, 3.1448], address: 'Jalan Lembah Perdana, Lake Gardens' },
  { id: 'mus-3',  name: 'Bank Negara Malaysia Museum',    categoryId: 'museum', coords: [101.6952, 3.1540], address: 'Jalan Dato Onn, City Centre' },
  { id: 'mus-4',  name: 'KL City Gallery',               categoryId: 'museum', coords: [101.6945, 3.1468], address: '27 Jalan Raja, Dataran Merdeka' },
  { id: 'mus-5',  name: 'Petrosains Science Discovery',  categoryId: 'museum', coords: [101.7113, 3.1576], address: 'Suria KLCC, Level 4' },

  // ── NIGHTLIFE ────────────────────────────────────────────────────
  { id: 'nite-1', name: 'Zouk Club KL',                  categoryId: 'nightlife', coords: [101.7118, 3.1555], address: 'TREC KL, Jalan Tun Razak' },
  { id: 'nite-2', name: 'TREC KL Entertainment District',categoryId: 'nightlife', coords: [101.7122, 3.1560], address: 'Jalan Tun Razak, KL' },
  { id: 'nite-3', name: 'Whisky Bar KL',                 categoryId: 'nightlife', coords: [101.7085, 3.1510], address: 'Jalan Mesui, Bukit Bintang' },
  { id: 'nite-4', name: 'Stereolab Music Bar KL',        categoryId: 'nightlife', coords: [101.7080, 3.1502], address: 'Jalan Mesui, Bukit Bintang' },

  // ── TRANSIT ──────────────────────────────────────────────────────
  { id: 'trn-1',  name: 'Bukit Bintang MRT Station',     categoryId: 'transit', coords: [101.7107, 3.1472], address: 'Jalan Bukit Bintang' },
  { id: 'trn-2',  name: 'Hang Tuah LRT & Monorail',      categoryId: 'transit', coords: [101.7062, 3.1402], address: 'Jalan Hang Tuah, Pudu' },
  { id: 'trn-3',  name: 'TRX MRT Station',               categoryId: 'transit', coords: [101.7198, 3.1425], address: 'Jalan Tun Razak, Imbi' },
  { id: 'trn-4',  name: 'KL Sentral Station',            categoryId: 'transit', coords: [101.6862, 3.1340], address: 'Brickfields, KL' },
  { id: 'trn-5',  name: 'Dang Wangi LRT Station',        categoryId: 'transit', coords: [101.7028, 3.1575], address: 'Jalan Ampang, Dang Wangi' },
  { id: 'trn-6',  name: 'KLCC LRT Station',              categoryId: 'transit', coords: [101.7138, 3.1583], address: 'Jalan Ampang, KLCC' },
  { id: 'trn-7',  name: 'Imbi Monorail Station',         categoryId: 'transit', coords: [101.7100, 3.1450], address: 'Jalan Imbi, KL' },
  { id: 'trn-8',  name: 'Raja Chulan Monorail Station',  categoryId: 'transit', coords: [101.7132, 3.1510], address: 'Jalan Raja Chulan, KL' },
  { id: 'trn-9',  name: 'Sultan Ismail Monorail',        categoryId: 'transit', coords: [101.7085, 3.1543], address: 'Jalan Sultan Ismail, KL' },
  { id: 'trn-10', name: 'Chow Kit LRT Station',          categoryId: 'transit', coords: [101.7015, 3.1650], address: 'Jalan Raja Laut, Chow Kit' },
  { id: 'trn-11', name: 'Masjid Jamek LRT Station',      categoryId: 'transit', coords: [101.6972, 3.1482], address: 'Jalan Tun Perak, Masjid Jamek' },
  { id: 'trn-12', name: 'Pasar Seni LRT Station',        categoryId: 'transit', coords: [101.6962, 3.1440], address: 'Jalan Sultan Mohammed, Chinatown' },
  { id: 'trn-13', name: 'Bangsar LRT Station',           categoryId: 'transit', coords: [101.6705, 3.1295], address: 'Jalan Travers, Bangsar' },
  { id: 'trn-14', name: 'Merdeka MRT Station',           categoryId: 'transit', coords: [101.6975, 3.1452], address: 'Jalan Stadium, City Centre' },
  { id: 'trn-15', name: 'Titiwangsa MRT Station',        categoryId: 'transit', coords: [101.7083, 3.1738], address: 'Jalan Pahang, Titiwangsa' },

  // ── HOTELS ───────────────────────────────────────────────────────
  { id: 'hot-1',  name: 'The Ritz-Carlton Kuala Lumpur', categoryId: 'hotel', coords: [101.7145, 3.1470], address: '168 Jalan Imbi' },
  { id: 'hot-2',  name: 'Mandarin Oriental KL',          categoryId: 'hotel', coords: [101.7138, 3.1568], address: 'Kuala Lumpur City Centre' },
  { id: 'hot-3',  name: 'Traders Hotel KL',              categoryId: 'hotel', coords: [101.7112, 3.1568], address: 'KLCC, Jalan Ampang' },
  { id: 'hot-4',  name: 'Aloft KL Sentral',              categoryId: 'hotel', coords: [101.6858, 3.1338], address: 'Jalan Stesen Sentral 5, Brickfields' },
  { id: 'hot-5',  name: 'Le Meridien KL',                categoryId: 'hotel', coords: [101.6860, 3.1350], address: 'Jalan Stesen Sentral 5' },
  { id: 'hot-6',  name: 'Hilton Kuala Lumpur',           categoryId: 'hotel', coords: [101.6858, 3.1342], address: 'Jalan Stesen Sentral 3' },
  { id: 'hot-7',  name: 'Grand Hyatt Kuala Lumpur',      categoryId: 'hotel', coords: [101.7120, 3.1565], address: '12 Jalan Pinang, KLCC' },
  { id: 'hot-8',  name: 'Banyan Tree KL',                categoryId: 'hotel', coords: [101.7153, 3.1488], address: '2 Jalan Conlay, KL' },
  { id: 'hot-9',  name: 'JW Marriott Hotel KL',          categoryId: 'hotel', coords: [101.7128, 3.1484], address: '183 Jalan Bukit Bintang' },
  { id: 'hot-10', name: 'Sunway Putra Hotel',            categoryId: 'hotel', coords: [101.7048, 3.1603], address: '100 Jalan Putra, Chow Kit' },

  // ── HOSPITALS ────────────────────────────────────────────────────
  { id: 'hosp-1', name: 'Prince Court Medical Centre',   categoryId: 'hospital', coords: [101.7208, 3.1498], address: '39 Jalan Kia Peng' },
  { id: 'hosp-2', name: 'Tung Shin Hospital',            categoryId: 'hospital', coords: [101.7060, 3.1450], address: '102 Jalan Pudu' },
  { id: 'hosp-3', name: 'KPJ Tawakkal Hospital',        categoryId: 'hospital', coords: [101.6992, 3.1615], address: 'Jalan Pahang, Chow Kit' },
  { id: 'hosp-4', name: 'Gleneagles Kuala Lumpur',      categoryId: 'hospital', coords: [101.7225, 3.1555], address: '286 & 288 Jalan Ampang' },
  { id: 'hosp-5', name: 'Hospital Kuala Lumpur (HKL)',  categoryId: 'hospital', coords: [101.6955, 3.1575], address: 'Jalan Pahang, City Centre' },

  // ── PHARMACIES ───────────────────────────────────────────────────
  { id: 'phar-1', name: 'Watsons Pavilion KL',           categoryId: 'pharmacy', coords: [101.7135, 3.1488], address: 'Level 1, Pavilion KL' },
  { id: 'phar-2', name: 'Guardian Pharmacy KLCC',        categoryId: 'pharmacy', coords: [101.7110, 3.1572], address: 'Suria KLCC, Level 2' },
  { id: 'phar-3', name: 'Caring Pharmacy Berjaya Times', categoryId: 'pharmacy', coords: [101.7098, 3.1422], address: 'Level 1, Berjaya Times Square' },
  { id: 'phar-4', name: 'Alpro Pharmacy Imbi',           categoryId: 'pharmacy', coords: [101.7105, 3.1438], address: 'Jalan Imbi, KL' },
  { id: 'phar-5', name: 'Pharmakon Bukit Bintang',       categoryId: 'pharmacy', coords: [101.7095, 3.1462], address: 'Jalan Bukit Bintang, KL' },

  // ── BANKS / ATMs ─────────────────────────────────────────────────
  { id: 'atm-1',  name: 'Maybank Pavilion KL',           categoryId: 'atm', coords: [101.7131, 3.1485], address: 'Level G, Pavilion KL' },
  { id: 'atm-2',  name: 'CIMB Bank KLCC',                categoryId: 'atm', coords: [101.7113, 3.1575], address: 'Suria KLCC, Level 1' },
  { id: 'atm-3',  name: 'Public Bank Bukit Bintang',     categoryId: 'atm', coords: [101.7108, 3.1470], address: 'Jalan Bukit Bintang, KL' },
  { id: 'atm-4',  name: 'HSBC Bank Jalan Sultan Ismail', categoryId: 'atm', coords: [101.7062, 3.1540], address: 'Jalan Sultan Ismail, KL' },
  { id: 'atm-5',  name: 'Ambank KL Sentral',             categoryId: 'atm', coords: [101.6870, 3.1340], address: 'KL Sentral, Brickfields' },

  // ── GAS STATIONS ─────────────────────────────────────────────────
  { id: 'gas-1',  name: 'Shell Jalan Tun Razak',         categoryId: 'gas', coords: [101.7190, 3.1460], address: 'Jalan Tun Razak, Pudu' },
  { id: 'gas-2',  name: 'Petronas Jalan Pudu',           categoryId: 'gas', coords: [101.7095, 3.1390], address: 'Jalan Pudu, Pudu' },
  { id: 'gas-3',  name: 'BHP Jalan Bukit Bintang',       categoryId: 'gas', coords: [101.7070, 3.1455], address: 'Jalan Bukit Bintang, KL' },
  { id: 'gas-4',  name: 'Petronas Bangsar',              categoryId: 'gas', coords: [101.6705, 3.1303], address: 'Jalan Telawi, Bangsar' },

  // ── CONVENIENCE ──────────────────────────────────────────────────
  { id: 'conv-1', name: 'FamilyMart Jalan Imbi',         categoryId: 'convenience', coords: [101.7115, 3.1430], address: '42 Jalan Imbi' },
  { id: 'conv-2', name: 'FamilyMart KLCC',               categoryId: 'convenience', coords: [101.7118, 3.1573], address: 'Suria KLCC, Level G' },
  { id: 'conv-3', name: '7-Eleven Bukit Bintang',        categoryId: 'convenience', coords: [101.7092, 3.1468], address: 'Jalan Bukit Bintang, KL' },
  { id: 'conv-4', name: '7-Eleven Jalan Alor',           categoryId: 'convenience', coords: [101.7081, 3.1462], address: 'Jalan Alor, Bukit Bintang' },
  { id: 'conv-5', name: 'myNEWS Pavilion KL',            categoryId: 'convenience', coords: [101.7133, 3.1487], address: 'Level G, Pavilion KL' },
  { id: 'conv-6', name: 'KK Super Mart Cheras',          categoryId: 'convenience', coords: [101.7255, 3.1282], address: 'Jalan Cheras, Cheras' },

  // ── APPAREL ──────────────────────────────────────────────────────
  { id: 'app-1',  name: 'Uniqlo Fahrenheit88',           categoryId: 'apparel', coords: [101.7124, 3.1477], address: '179 Jalan Bukit Bintang' },
  { id: 'app-2',  name: 'H&M Pavilion KL',               categoryId: 'apparel', coords: [101.7136, 3.1490], address: 'Level 4, Pavilion KL' },
  { id: 'app-3',  name: 'Zara Pavilion KL',              categoryId: 'apparel', coords: [101.7137, 3.1489], address: 'Level 4, Pavilion KL' },
  { id: 'app-4',  name: 'Louis Vuitton Starhill Gallery',categoryId: 'apparel', coords: [101.7130, 3.1480], address: 'Feast Floor, Starhill Gallery' },
  { id: 'app-5',  name: 'Cotton On Berjaya Times',       categoryId: 'apparel', coords: [101.7101, 3.1424], address: 'Level 1, Berjaya Times Square' },

  // ── ELECTRONICS ──────────────────────────────────────────────────
  { id: 'elec-1', name: 'Machines Apple Premium Pavilion',categoryId: 'electronics', coords: [101.7136, 3.1487], address: 'Level 4, Pavilion KL' },
  { id: 'elec-2', name: 'Samsung KL Premium Store',      categoryId: 'electronics', coords: [101.7120, 3.1487], address: 'Lot 10, Level 3' },
  { id: 'elec-3', name: 'Harvey Norman TRX',             categoryId: 'electronics', coords: [101.7185, 3.1430], address: 'The Exchange TRX, Level 3' },
  { id: 'elec-4', name: 'Senq Low Yat Plaza',            categoryId: 'electronics', coords: [101.7108, 3.1455], address: 'Plaza Low Yat, Bukit Bintang' },

  // ── PARKING ──────────────────────────────────────────────────────
  { id: 'pkng-1', name: 'Pavilion KL Parking',          categoryId: 'parking', coords: [101.7132, 3.1483], address: 'Pavilion KL, Jalan Bukit Bintang' },
  { id: 'pkng-2', name: 'Suria KLCC Parking',           categoryId: 'parking', coords: [101.7115, 3.1571], address: 'Suria KLCC, Jalan Ampang' },
  { id: 'pkng-3', name: 'TRX Parking Complex',          categoryId: 'parking', coords: [101.7186, 3.1430], address: 'The Exchange TRX, Imbi' },
  { id: 'pkng-4', name: 'Public Parking Jalan Pudu',    categoryId: 'parking', coords: [101.7075, 3.1418], address: 'Jalan Pudu, KL' },

  // ── EV CHARGING ──────────────────────────────────────────────────
  { id: 'ev-1',   name: 'Gentari EV Charging TRX',       categoryId: 'ev', coords: [101.7180, 3.1435], address: 'Basement B1, The Exchange TRX' },
  { id: 'ev-2',   name: 'ChargEV Pavilion KL',           categoryId: 'ev', coords: [101.7130, 3.1480], address: 'Basement B3, Pavilion KL' },
  { id: 'ev-3',   name: 'Tesla Supercharger KLCC',       categoryId: 'ev', coords: [101.7118, 3.1567], address: 'Suria KLCC, Basement' },
  { id: 'ev-4',   name: 'JomCharge MyTOWN',              categoryId: 'ev', coords: [101.7228, 3.1342], address: 'MyTOWN Shopping Centre, Basement' },
  { id: 'ev-5',   name: 'TNB EVolt KL Sentral',          categoryId: 'ev', coords: [101.6860, 3.1345], address: 'KL Sentral Station, Brickfields' },

  // ── SALONS / SPAS ────────────────────────────────────────────────
  { id: 'sal-1',  name: 'Toni & Guy Pavilion',           categoryId: 'salon', coords: [101.7132, 3.1490], address: 'Level 3, Pavilion KL' },
  { id: 'sal-2',  name: 'Regis Salon KLCC',              categoryId: 'salon', coords: [101.7110, 3.1574], address: 'Suria KLCC, Level 2' },
  { id: 'sal-3',  name: 'Jing Hua Spa Bukit Bintang',   categoryId: 'salon', coords: [101.7090, 3.1480], address: 'Jalan Bukit Bintang, KL' },
  { id: 'sal-4',  name: 'Hair Room Bangsar',             categoryId: 'salon', coords: [101.6715, 3.1300], address: 'Jalan Telawi, Bangsar' },
];
