import { useEffect, useMemo, useRef, useState } from 'react';
import './features/ai/styles.css';
import { initMapFeature, searchPlace, getLocationRequirement, getMapboxToken } from './features/map/index.js';
import { mapboxConfig } from '../config.js';
import {
  CATEGORY_GROUPS,
  ALL_CATEGORY_ITEMS,
  PRESET_LOCATIONS,
  PLACES_DATA,
  CATEGORY_SHAPES,
} from './features/map/placesData.js';
import { calculateAmenitiesDensityScore } from './features/density/index.js';
import { generatePdfAnalysisReport } from './features/export/index.js';
import { calculateSiteComparison } from './features/comparison/index.js';
import {
  callAiChatApi,
  isAiApiConfigured,
  getAiApiConfig,
  validateUserInput,
  detectAccessibilityIntent,
} from './features/ai/index.js';
import { SettingsSection, saveFavoriteLocation } from './features/settings/index.js';
import { SustainabilityPanel } from './features/sustainability/index.js';
import PlaceSearch from './features/map/PlaceSearch.jsx';

const TRAVEL_MODES = [
  { id: 'walking', label: 'Walk', speed: '4.5 km/h', desc: 'Pedestrian paths & sidewalks' },
  { id: 'cycling', label: 'Bike', speed: '15 km/h', desc: 'Bike lanes & secondary roads' },
  { id: 'driving', label: 'Drive', speed: 'Live road', desc: 'Real-time road network routing' },
];

const TRAVEL_MINUTES = [
  { value: 10, label: '10 min', color: '#22c55e', dotClass: 'c-10', cardClass: 'm-10' },
  { value: 20, label: '20 min', color: '#eab308', dotClass: 'c-20', cardClass: 'm-20' },
  { value: 30, label: '30 min', color: '#f97316', dotClass: 'c-30', cardClass: 'm-30' },
];

const INITIAL_SELECTED_CATEGORIES = [
  'restaurant',
  'cafe',
  'mall',
  'grocery',
  'lrt-station',
  'train-station',
  'bus-station',
  'monorail-station',
  'kindergarten',
  'primary-school',
  'secondary',
  'university',
  'tuition-centre',
];

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const appRef = useRef(null);
  const leftNavRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapErrorRef = useRef(null);
  const mapFeatureRef = useRef(null);
  const messagesEndRef = useRef(null);
  // Ref to track current origin for use inside callbacks
  const currentOriginRef = useRef(PRESET_LOCATIONS[0]);

  // Left Navigation Bar state
  const [activeNavTab, setActiveNavTab] = useState('chat'); // 'chat' | 'travel' | 'settings'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullSize, setIsFullSize] = useState(false);

  // Location selection state
  const [selectedLocation, setSelectedLocation] = useState(PRESET_LOCATIONS[0]);
  const [locationAInput, setLocationAInput] = useState(PRESET_LOCATIONS[0].name);
  const [isSearchingA, setIsSearchingA] = useState(false);

  // Map and Travel state
  const [mapMode, setMapMode] = useState('2d');
  const [errorMessage, setErrorMessage] = useState('');
  const [travelMode, setTravelMode] = useState('walking');
  const [travelMinutes, setTravelMinutes] = useState(20);
  // Track whether analysis has been run and analysis result
  const [analysisRun, setAnalysisRun] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [densityScore, setDensityScore] = useState(null);
  const [showLabels, setShowLabels] = useState(false);

  // Site Comparison state
  const [compareSiteA, setCompareSiteA] = useState(PRESET_LOCATIONS[0]);
  const [compareSiteB, setCompareSiteB] = useState(PRESET_LOCATIONS[1]);
  const [locationBInput, setLocationBInput] = useState(PRESET_LOCATIONS[1].name);
  const [isSearchingB, setIsSearchingB] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);

  // Pin on map mode ('none' | 'A' | 'B' | 'bookmark')
  const [pinMode, setPinMode] = useState('none');
  const pinModeRef = useRef('none');
  pinModeRef.current = pinMode;
  const activeTargetRef = useRef('A'); // Tracks active input target ('A' | 'B' | 'bookmark' | 'destination')
  const [favoritesTrigger, setFavoritesTrigger] = useState(0);

  // Sustainability Destination & Comparison state
  const [destination, setDestination] = useState(null);
  const [pickingDestination, setPickingDestination] = useState(false);
  const pickingDestinationRef = useRef(false);
  pickingDestinationRef.current = pickingDestination;
  const [carbonComparison, setCarbonComparison] = useState(null);
  // Ref to track parameters of active analysis to prevent accidental wipeout by effects
  const currentAnalysisParamsRef = useRef(null);

  const toggleDestinationPick = () => {
    const next = !pickingDestination;
    setPickingDestination(next);
    pickingDestinationRef.current = next;
    setPinMode(next ? 'destination' : 'none');
  };

  const selectSustainabilityPlace = (place, target = 'destination') => {
    if (target === 'destination') {
      setDestination(place);
      mapFeatureRef.current?.updateDestination(place);
    } else {
      setSelectedLocation(place);
      setLocationAInput(place.name);
      setAnalysisRun(false);
      setAnalysisResult(null);
      setDensityScore(null);
      setComparisonResult(null);
      setIsSplitViewActive(false);
      mapFeatureRef.current?.clearIsochrone();
      mapFeatureRef.current?.clearComparison();
      mapFeatureRef.current?.updateOrigin(place);
      currentOriginRef.current = place;
    }
    pickingDestinationRef.current = false;
    setPickingDestination(false);
    setPinMode('none');
    mapFeatureRef.current?.map?.flyTo({ center: place.coords, zoom: 13, duration: 800 });
  };

  // Search / geocode address for Location A
  const handleSearchLocationA = async (query = locationAInput) => {
    const q = String(query || '').trim();
    if (!q) return;
    setIsSearchingA(true);
    try {
      const res = await searchPlace(q);
      if (res) {
        const newLoc = {
          id: `loc-a-${Date.now()}`,
          name: res.shortName || res.name,
          address: res.address,
          coords: res.coords,
          type: res.type || 'Custom Place',
        };
        setSelectedLocation(newLoc);
        setLocationAInput(newLoc.name);
        setAnalysisRun(false);
        setAnalysisResult(null);
        setComparisonResult(null);
        setIsSplitViewActive(false);
        mapFeatureRef.current?.clearIsochrone();
        mapFeatureRef.current?.clearComparison();
        mapFeatureRef.current?.updateOrigin(newLoc);
        mapFeatureRef.current?.map.flyTo({ center: newLoc.coords, zoom: 13, duration: 800 });
        currentOriginRef.current = newLoc;
      } else {
        setErrorMessage(`Could not find coordinates for "${q}". Try a different address.`);
      }
    } catch (err) {
      console.warn('Geocoding Location A error:', err);
      setErrorMessage(`Geocoding error: ${err.message}`);
    } finally {
      setIsSearchingA(false);
    }
  };

  // Search / geocode address for Location B
  const handleSearchLocationB = async (query = locationBInput) => {
    const q = String(query || '').trim();
    if (!q) return;
    setIsSearchingB(true);
    try {
      const res = await searchPlace(q);
      if (res) {
        const newLoc = {
          id: `loc-b-${Date.now()}`,
          name: res.shortName || res.name,
          address: res.address,
          coords: res.coords,
          type: res.type || 'Custom Place',
        };
        setCompareSiteB(newLoc);
        setLocationBInput(newLoc.address || newLoc.name);
        setComparisonResult(null);
        mapFeatureRef.current?.updateSiteB(newLoc);
        mapFeatureRef.current?.flyTo(newLoc.coords);
        if (isSplitViewActive) {
          setIsSplitViewActive(false);
          mapFeatureRef.current?.stopSplitMapB();
        }
      } else {
        setErrorMessage(`Could not find coordinates for "${q}". Try a different address.`);
      }
    } catch (err) {
      console.warn('Geocoding Location B error:', err);
      setErrorMessage(`Geocoding error: ${err.message}`);
    } finally {
      setIsSearchingB(false);
    }
  };

  // Split-Screen Comparison Slider state
  const mapContainerBRef = useRef(null);
  const [isSplitViewActive, setIsSplitViewActive] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Responsive screen orientation (desktop: left/right, mobile: up/down)
  useEffect(() => {
    const checkScreen = () => {
      setIsMobileScreen(window.innerWidth <= 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Drag interaction for split screen divider
  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMove = (e) => {
      const container = appRef.current || document.body;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (isMobileScreen) {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const pct = Math.max(10, Math.min(90, ((clientY - rect.top) / rect.height) * 100));
        setSplitPosition(pct);
      } else {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const pct = Math.max(10, Math.min(90, ((clientX - rect.left) / rect.width) * 100));
        setSplitPosition(pct);
      }
    };

    const handleUp = () => {
      setIsDraggingSplit(false);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingSplit, isMobileScreen]);

  // Manage Mapbox instance B when split view toggles
  const isSplitRunningRef = useRef(false);
  useEffect(() => {
    if (isSplitViewActive && mapFeatureRef.current && mapContainerBRef.current) {
      mapFeatureRef.current.startSplitMapB({ containerB: mapContainerBRef.current });
      isSplitRunningRef.current = true;
      setTimeout(() => {
        mapFeatureRef.current?.resize();
      }, 50);
    } else if (!isSplitViewActive && mapFeatureRef.current && isSplitRunningRef.current) {
      mapFeatureRef.current.stopSplitMapB();
      isSplitRunningRef.current = false;
      setTimeout(() => {
        mapFeatureRef.current?.resize();
      }, 50);
    }
  }, [isSplitViewActive]);

  // Resize both maps when split slider moves
  useEffect(() => {
    if (isSplitViewActive && mapFeatureRef.current) {
      mapFeatureRef.current.resize();
    }
  }, [splitPosition, isSplitViewActive]);

  // Categorized Multi-selection state
  const [allMenuOpen, setAllMenuOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(INITIAL_SELECTED_CATEGORIES);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const allMenuRef = useRef(null);

  // Horizontal category strip drag-to-scroll refs & handlers
  const categoryStripRef = useRef(null);
  const isStripDownRef = useRef(false);
  const stripStartXRef = useRef(0);
  const stripScrollLeftRef = useRef(0);
  const isStripDraggingRef = useRef(false);

  const handleCategoryStripMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest('.all-multi-menu')) return;
    const el = categoryStripRef.current;
    if (!el) return;
    isStripDownRef.current = true;
    isStripDraggingRef.current = false;
    stripStartXRef.current = e.pageX - el.offsetLeft;
    stripScrollLeftRef.current = el.scrollLeft;
  };

  const handleCategoryStripMouseMove = (e) => {
    if (!isStripDownRef.current) return;
    const el = categoryStripRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - stripStartXRef.current) * 1.3;
    if (Math.abs(walk) > 4) {
      isStripDraggingRef.current = true;
    }
    el.scrollLeft = stripScrollLeftRef.current - walk;
  };

  const handleCategoryStripMouseUpOrLeave = () => {
    isStripDownRef.current = false;
    setTimeout(() => {
      isStripDraggingRef.current = false;
    }, 60);
  };

  const handleCategoryStripWheel = (e) => {
    const el = categoryStripRef.current;
    if (!el) return;
    if (e.deltaY !== 0 && e.deltaX === 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Interactive Amenities Filter Under Map Labels
  const [showAmenityChooser, setShowAmenityChooser] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState([]);

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  // Top action menus & Chat state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const aiConfig = useMemo(() => getAiApiConfig(), []);
  const [messages, setMessages] = useState([]);

  // Initialize Mapbox feature
  useEffect(() => {
    let isMounted = true;
    let createdFeature = null;

    async function init() {
      const apiKey = mapboxConfig?.token || (await getMapboxToken());

      if (!isMounted) return;

      if (!apiKey) {
        setErrorMessage('Missing MAPBOX_API_KEY in your .env file on the server.');
        return;
      }

      createdFeature = initMapFeature({
        apiKey,
        mapContainerRef,
        errorBoxRef: mapErrorRef,
        onModeChange: setMapMode,
        getPinMode: () => (pickingDestinationRef.current ? 'destination' : (pinModeRef.current !== 'none' ? pinModeRef.current : activeTargetRef.current)),
        onLocationPick: (customLoc, siteTarget = 'A') => {
          const target = siteTarget || activeTargetRef.current;
          if (pickingDestinationRef.current || target === 'destination' || pinModeRef.current === 'destination') {
            setDestination(customLoc);
            setPickingDestination(false);
            pickingDestinationRef.current = false;
            setPinMode('none');
            createdFeature.updateDestination(customLoc);
            return;
          }
          if (target === 'bookmark' || pinModeRef.current === 'bookmark') {
            saveFavoriteLocation(customLoc);
            setPinMode('none');
            setFavoritesTrigger((prev) => prev + 1);
            return;
          }
          if (target === 'B' || pinModeRef.current === 'B') {
            setCompareSiteB(customLoc);
            setLocationBInput(customLoc.address || customLoc.name);
            setPinMode('none');
            setComparisonResult(null);
            createdFeature.updateSiteB(customLoc);
            if (isSplitViewActive) {
              setIsSplitViewActive(false);
              createdFeature.stopSplitMapB();
            }
          } else {
            setSelectedLocation(customLoc);
            setLocationAInput(customLoc.address || customLoc.name);
            setPinMode('none');
            setAnalysisRun(false);
            setAnalysisResult(null);
            setDensityScore(null);
            setComparisonResult(null);
            setIsSplitViewActive(false);
            createdFeature.clearIsochrone();
            createdFeature.clearComparison();
            createdFeature.updateOrigin(customLoc);
            currentOriginRef.current = customLoc;
          }
        },
      });

      mapFeatureRef.current = createdFeature;
    }

    init();

    return () => {
      isMounted = false;
      if (createdFeature?.map) {
        createdFeature.map.remove();
      }
    };
  }, []);

  // When mode/minutes change manually while analysis is active, reset so user must re-run
  useEffect(() => {
    // If the state change matches the parameters that were just executed, preserve the analysis!
    if (
      currentAnalysisParamsRef.current &&
      currentAnalysisParamsRef.current.mode === travelMode &&
      currentAnalysisParamsRef.current.minutes === travelMinutes
    ) {
      return;
    }

    if (analysisRun) {
      setAnalysisRun(false);
      setAnalysisResult(null);
      setDensityScore(null);
      currentAnalysisParamsRef.current = null;
      mapFeatureRef.current?.clearIsochrone();
    }
  }, [travelMode, travelMinutes]);

  // Update POI markers on map when multi-selection changes (only if analysis or comparison is active)
  useEffect(() => {
    if (analysisRun && mapFeatureRef.current) {
      const stats = mapFeatureRef.current.updatePOIs(selectedCategories);
      if (stats && !stats.isComparison) {
        setAnalysisResult((prev) => ({
          ...prev,
          total: stats.total,
          complexes: stats.shownComplexes,
          typeBreakdown: stats.typeBreakdown,
          places: stats.places || [],
        }));
        const density = calculateAmenitiesDensityScore({
          isochroneGeometry: mapFeatureRef.current.getIsochroneGeometry(),
          places: stats.places || [],
          travelMinutes,
          mode: travelMode,
        });
        setDensityScore(density);
      }
    } else if (comparisonResult && mapFeatureRef.current) {
      const compStats = mapFeatureRef.current.updatePOIs(selectedCategories);
      if (compStats && compStats.isComparison) {
        const categoriesAll = Array.from(
          new Set([
            ...compStats.statsA.typeBreakdown.map((t) => t.id),
            ...compStats.statsB.typeBreakdown.map((t) => t.id),
          ])
        );
        const catLookup = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
        const categoryComparisons = categoriesAll.map((catId) => {
          const itemA = compStats.statsA.typeBreakdown.find((t) => t.id === catId);
          const itemB = compStats.statsB.typeBreakdown.find((t) => t.id === catId);
          const cat = catLookup.get(catId) || { label: catId, color: '#2563eb' };
          const countA = itemA ? itemA.count : 0;
          const countB = itemB ? itemB.count : 0;
          return {
            id: catId,
            label: cat.label || catId,
            countA,
            countB,
            difference: countA - countB,
            color: cat.color || '#2563eb',
            icon: cat.icon || '📍',
            shape: cat.shape || 'circle',
            shapeSymbol: cat.shapeSymbol || '●',
          };
        }).sort((a, b) => (b.countA + b.countB) - (a.countA + a.countB));

        setComparisonResult((prev) => ({
          ...prev,
          statsA: compStats.statsA,
          statsB: compStats.statsB,
          categoryComparisons,
        }));
      }
    }
  }, [selectedCategories, analysisRun, comparisonResult !== null, travelMinutes, travelMode]);

  // Handle outside clicks to close menus
  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!target.closest('.export-menu') && !target.closest('#export-toggle')) {
        setExportMenuOpen(false);
      }

      if (!target.closest('.all-multi-menu') && !target.closest('#all-toggle') && !target.closest('#shop-toggle')) {
        setAllMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, activeNavTab]);

  const toggleMapMode = () => {
    if (!mapFeatureRef.current) return;
    const nextMode = mapMode === '2d' ? '3d' : '2d';
    mapFeatureRef.current.applyMapView(nextMode);
    setMapMode(nextMode);
  };

  // Multi-selection helper functions
  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const toggleGroup = (groupId) => {
    const group = CATEGORY_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const groupItemIds = group.items.map((i) => i.id);
    const allChecked = groupItemIds.every((id) => selectedCategories.includes(id));

    if (allChecked) {
      setSelectedCategories((prev) => prev.filter((id) => !groupItemIds.includes(id)));
    } else {
      setSelectedCategories((prev) => Array.from(new Set([...prev, ...groupItemIds])));
    }
  };

  const selectAllCategories = () => {
    setSelectedCategories(ALL_CATEGORY_ITEMS.map((item) => item.id));
  };

  const clearAllCategories = () => {
    setSelectedCategories([]);
  };

  // Filter categories by search query
  const filteredCategoryGroups = useMemo(() => {
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) return CATEGORY_GROUPS;

    return CATEGORY_GROUPS.map((group) => {
      const matchedItems = group.items.filter(
        (item) => item.label.toLowerCase().includes(query) || group.name.toLowerCase().includes(query)
      );
      return { ...group, items: matchedItems };
    }).filter((group) => group.items.length > 0);
  }, [categorySearchQuery]);

  // Quick filter pill handlers (Restaurants, Transit, Things to do)
  const isGroupActive = (groupId) => {
    const group = CATEGORY_GROUPS.find((g) => g.id === groupId);
    if (!group) return false;
    return group.items.some((item) => selectedCategories.includes(item.id));
  };

  const handleQuickFilterClick = (groupId) => {
    toggleGroup(groupId);
  };

  // Export handling
  const handleExport = async (type) => {
    setExportMenuOpen(false);

    if (type === 'png') {
      const canvas = await window.html2canvas(document.getElementById('map'));
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, 'sime-darby-map.png');
        }
      }, 'image/png');
      return;
    }

    if (type === 'pdf') {
      let canvas = mapFeatureRef.current?.getMapCanvas();
      if (!canvas || canvas.width === 0) {
        canvas = await window.html2canvas(document.getElementById('map'));
      }

      let effectiveAnalysis = analysisResult;
      let effectiveDensity = densityScore;

      // If user exports before clicking "Run Analysis", generate reliable snapshot from PLACES_DATA
      if (!effectiveAnalysis) {
        const catMap = new Map(ALL_CATEGORY_ITEMS.map((c) => [c.id, c]));
        const filteredPlaces = PLACES_DATA.filter((p) => selectedCategories.includes(p.categoryId)).map((p) => ({
          ...p,
          cat: catMap.get(p.categoryId) || { label: p.categoryId, id: p.categoryId, color: '#2563eb' },
          band: travelMinutes,
          lat: p.coords[1],
          lon: p.coords[0],
        }));

        const counts = {};
        filteredPlaces.forEach((p) => {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        });

        const typeBreakdown = Object.keys(counts).map((catId) => {
          const cat = catMap.get(catId) || { label: catId, id: catId };
          return {
            id: catId,
            label: cat.label || catId,
            color: cat.color || '#2563eb',
            count: counts[catId],
            icon: cat.icon || '📍',
            groupName: cat.groupName || 'Amenity',
          };
        }).sort((a, b) => b.count - a.count);

        effectiveAnalysis = {
          total: filteredPlaces.length,
          source: 'Curated GIS Places',
          typeBreakdown,
          places: filteredPlaces,
          mode: travelMode,
          minutes: travelMinutes,
        };

        effectiveDensity = calculateAmenitiesDensityScore({
          isochroneGeometry: mapFeatureRef.current?.getIsochroneGeometry() || null,
          places: filteredPlaces,
          travelMinutes,
          mode: travelMode,
        });
      }

      await generatePdfAnalysisReport({
        mapCanvas: canvas,
        analysisResult: effectiveAnalysis,
        densityScore: effectiveDensity,
        locationName: selectedLocation.name,
        locationAddress: selectedLocation.address || '19, Jalan Pudu, Bukit Bintang, 55100 Kuala Lumpur',
        travelMode,
        travelMinutes,
      });
      return;
    }

    if (type === 'csv') {
      const rows = [
        'title,category,address,longitude,latitude',
        ...PLACES_DATA.filter((p) => selectedCategories.includes(p.categoryId)).map(
          (p) => `"${p.name}","${p.categoryId}","${p.address}",${p.coords[0]},${p.coords[1]}`
        ),
      ];

      downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), 'sime-darby-places.csv');
    }
  };

  // Dedicated helper to execute isochrone accessibility analysis on the live map
  const executeAnalysis = async ({
    origin = selectedLocation,
    mode = travelMode,
    minutes = travelMinutes,
    categories = selectedCategories,
  } = {}) => {
    if (!mapFeatureRef.current) return null;

    setAnalysisLoading(true);
    setErrorMessage('');

    try {
      const res = await mapFeatureRef.current.runAnalysis({
        origin,
        mode,
        minutes,
        selectedCategoryIds: categories,
      });

      const density = calculateAmenitiesDensityScore({
        isochroneGeometry: res.isochroneGeometry,
        places: res.places || [],
        travelMinutes: minutes,
        mode,
      });

      // Track executed parameters so useEffect does not clear them
      currentAnalysisParamsRef.current = {
        originId: origin.id || origin.name,
        mode,
        minutes,
      };

      setTravelMode(mode);
      setTravelMinutes(minutes);
      setSelectedLocation(origin);
      setLocationAInput(origin.name);
      setAnalysisRun(true);
      setAnalysisResult(res);
      setDensityScore(density);

      return {
        success: true,
        result: res,
        densityScore: density,
        origin,
        mode,
        minutes,
      };
    } catch (err) {
      console.error('Isochrone analysis error:', err);
      setErrorMessage(err.message || 'Analysis failed. Please check network and API keys.');
      return { success: false, error: err.message };
    } finally {
      setAnalysisLoading(false);
    }
  };

  // AI chat send handler with guardrails, SQLi defense, prompt injection defense, and automated map accessibility execution
  const handleSend = async (textToSend = null) => {
    const nextMessage = (textToSend ?? draft).trim();
    if (!nextMessage || isAiThinking) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: nextMessage,
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setDraft('');
    setIsAiThinking(true);

    // 1. Pre-execution Security & Relevance Validation (SQLi, Prompt Injection, Domain Relevance)
    const validation = validateUserInput(nextMessage);
    if (!validation.isValid) {
      const guardrailReply = {
        id: Date.now() + 1,
        sender: 'bot',
        text: validation.message,
        source: 'guardrail_block',
        model: 'security-guardrail',
      };
      setMessages((previousMessages) => [...previousMessages, guardrailReply]);
      setIsAiThinking(false);
      return;
    }

    try {
      // 2. Check for Accessibility Analysis Intent
      const accessibilityIntent = detectAccessibilityIntent(nextMessage, {
        travelMode,
        travelMinutes,
        locationName: selectedLocation.name,
      });

      let effectiveOrigin = selectedLocation;
      let effectiveMode = travelMode;
      let effectiveMinutes = travelMinutes;
      let executedResult = null;
      let isActionExecuted = false;

      if (accessibilityIntent.isAccessibilityIntent) {
        // If sidebar is in full-size expanded mode, restore normal mode so map is visible!
        if (isFullSize) {
          setIsFullSize(false);
        }

        // Resolve target location if specified
        if (accessibilityIntent.params?.matchedPreset) {
          effectiveOrigin = accessibilityIntent.params.matchedPreset;
        } else if (accessibilityIntent.params?.locationQuery) {
          try {
            const geocoded = await searchPlace(accessibilityIntent.params.locationQuery);
            if (geocoded && geocoded.coords) {
              effectiveOrigin = {
                id: `ai-loc-${Date.now()}`,
                name: geocoded.shortName || geocoded.name,
                address: geocoded.address || geocoded.name,
                coords: geocoded.coords,
                type: geocoded.type || 'Custom Place',
              };
            }
          } catch (geoErr) {
            console.warn('AI location geocoding fallback:', geoErr);
          }
        }

        if (accessibilityIntent.params?.mode) {
          effectiveMode = accessibilityIntent.params.mode;
        }
        if (accessibilityIntent.params?.minutes) {
          effectiveMinutes = accessibilityIntent.params.minutes;
        }

        // Update origin marker and fly to coordinates if location changed
        if (effectiveOrigin.id !== selectedLocation.id || effectiveOrigin.name !== selectedLocation.name) {
          setSelectedLocation(effectiveOrigin);
          setLocationAInput(effectiveOrigin.name);
          mapFeatureRef.current?.updateOrigin(effectiveOrigin);
          mapFeatureRef.current?.map?.flyTo({ center: effectiveOrigin.coords, zoom: 13, duration: 800 });
          currentOriginRef.current = effectiveOrigin;
        }

        // Execute map analysis directly on the map
        executedResult = await executeAnalysis({
          origin: effectiveOrigin,
          mode: effectiveMode,
          minutes: effectiveMinutes,
          categories: selectedCategories,
        });

        isActionExecuted = Boolean(executedResult?.success);
      }

      // 3. Call AI Chat Service with updated live spatial context
      const response = await callAiChatApi({
        prompt: nextMessage,
        messages: [...messages, userMessage],
        context: {
          locationName: effectiveOrigin.name,
          locationAddress: effectiveOrigin.address,
          destination,
          sustainability: carbonComparison,
          travelMode: effectiveMode,
          travelMinutes: effectiveMinutes,
          totalPlaces: executedResult?.result?.total ?? (analysisResult?.total || PLACES_DATA.filter((p) => selectedCategories.includes(p.categoryId)).length),
          densityScore: executedResult?.densityScore ?? densityScore,
          analysisResult: executedResult?.result ?? analysisResult,
          selectedCategories,
          isComparison: isComparing,
          comparisonResult,
          isAnalysisAction: isActionExecuted,
          isLocationAction: isActionExecuted,
        },
      });

      const botReply = {
        id: Date.now() + 1,
        sender: 'bot',
        text: response.text,
        source: response.source,
        model: response.model,
      };

      setMessages((previousMessages) => [...previousMessages, botReply]);
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Unable to complete the AI analysis. Please check your network and API settings.',
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleRunAnalysis = async () => {
    await executeAnalysis({
      origin: selectedLocation,
      mode: travelMode,
      minutes: travelMinutes,
      categories: selectedCategories,
    });
  };

  const handleRunComparison = async () => {
    if (!mapFeatureRef.current) return;

    setComparisonLoading(true);
    setErrorMessage('');

    try {
      const res = await mapFeatureRef.current.runDualSiteAnalysis({
        siteA: selectedLocation,
        siteB: compareSiteB,
        mode: travelMode,
        minutes: travelMinutes,
        selectedCategoryIds: selectedCategories,
      });

      const densityA = calculateAmenitiesDensityScore({
        isochroneGeometry: res.isochroneGeometryA,
        places: res.statsA.places || [],
        travelMinutes,
        mode: travelMode,
      });

      const densityB = calculateAmenitiesDensityScore({
        isochroneGeometry: res.isochroneGeometryB,
        places: res.statsB.places || [],
        travelMinutes,
        mode: travelMode,
      });

      const comp = calculateSiteComparison({
        siteA: selectedLocation,
        siteB: compareSiteB,
        statsA: res.statsA,
        statsB: res.statsB,
        densityA,
        densityB,
        mode: travelMode,
        minutes: travelMinutes,
      });

      setIsComparing(true);
      setComparisonResult(comp);
      setAnalysisRun(true);
    } catch (err) {
      console.error('Comparison error:', err);
      setErrorMessage(err.message || 'Comparison failed. Please check network and API keys.');
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleToggleSplitScreen = async () => {
    if (isSplitViewActive) {
      setIsSplitViewActive(false);
      mapFeatureRef.current?.stopSplitMapB();
      return;
    }

    if (!comparisonResult && mapFeatureRef.current) {
      await handleRunComparison();
    }
    setIsSplitViewActive(true);
  };

  const handleSplitDragStart = (e) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };


  const activeTravelModeObj = TRAVEL_MODES.find((mode) => mode.id === travelMode) ?? TRAVEL_MODES[0];
  const activeMinutesObj = TRAVEL_MINUTES.find((m) => m.value === travelMinutes) ?? TRAVEL_MINUTES[1];

  const reachablePlacesCount = useMemo(() => {
    return PLACES_DATA.filter((p) => selectedCategories.includes(p.categoryId)).length;
  }, [selectedCategories]);

  return (
    <div id="app" ref={appRef} className={isFullSize ? 'chat-only' : ''}>
      {/* Map container for Site A */}
      <div
        id="map"
        ref={mapContainerRef}
        style={
          isSplitViewActive
            ? isMobileScreen
              ? { height: `${splitPosition}%`, width: '100%', position: 'absolute', top: 0, left: 0 }
              : { width: `${splitPosition}%`, height: '100%', position: 'absolute', top: 0, left: 0 }
            : {}
        }
      />

      {/* Draggable Split Screen Map Container for Site B */}
      {isSplitViewActive ? (
        <>
          <div
            id="split-map-container"
            ref={mapContainerBRef}
            className="split-map-container-layer"
            style={
              isMobileScreen
                ? { top: `${splitPosition}%`, height: `${100 - splitPosition}%`, width: '100%', position: 'absolute', left: 0 }
                : { left: `${splitPosition}%`, width: `${100 - splitPosition}%`, height: '100%', position: 'absolute', top: 0 }
            }
          />

          {/* Draggable Divider Line and Circular Handle (Styled after reference image) */}
          <div
            className={`split-divider-line ${isMobileScreen ? 'horizontal' : 'vertical'}`}
            style={
              isMobileScreen
                ? { top: `${splitPosition}%` }
                : { left: `${splitPosition}%` }
            }
            onMouseDown={handleSplitDragStart}
            onTouchStart={handleSplitDragStart}
          >
            <button
              type="button"
              className={`split-handle-button ${isDraggingSplit ? 'dragging' : ''}`}
              aria-label="Drag to adjust split comparison slider"
              onMouseDown={handleSplitDragStart}
              onTouchStart={handleSplitDragStart}
            >
              <span className="split-handle-icon">
                {isMobileScreen ? '⥯' : '<>'}
              </span>
            </button>
          </div>

          {/* Floating Site Badges */}
          <div
            className="split-badge-floating site-a"
            style={isMobileScreen ? { left: 16, top: 16 } : { left: isSidebarCollapsed ? 20 : 450, top: 66 }}
          >
            📍 Site A: {selectedLocation.name}
          </div>

          <div
            className="split-badge-floating site-b"
            style={isMobileScreen ? { left: 16, bottom: 20 } : { right: 20, top: 66 }}
          >
            📍 Site B: {compareSiteB.name}
          </div>

          <button
            type="button"
            className="split-close-floating-btn"
            style={isMobileScreen ? { right: 16, top: 16, left: 'auto', transform: 'none' } : {}}
            onClick={() => {
              setIsSplitViewActive(false);
              mapFeatureRef.current?.stopSplitMapB();
            }}
          >
            ✕ Exit Split Screen
          </button>
        </>
      ) : null}

      {/* Floating Analysis Loading Indicator */}
      {analysisLoading || comparisonLoading ? (
        <div className="analysis-loading-banner">
          <div className="loading-spinner" />
          <span>Searching Google Places within {travelMinutes}-minute {activeTravelModeObj.label.toLowerCase()} reach...</span>
        </div>
      ) : null}

      {/* Floating Pin Mode Banner */}
      {pinMode !== 'none' || pickingDestination ? (
        <div className="pin-mode-banner">
          <span>
            📍 Click anywhere on the map to pin{' '}
            {pinMode === 'destination' || pickingDestination
              ? 'Destination for Sustainability Journey'
              : pinMode === 'A'
              ? 'Location A (Primary Site)'
              : pinMode === 'B'
              ? 'Location B (Comparison Site)'
              : 'Bookmark Location'}
          </span>
          <button
            type="button"
            className="pin-mode-cancel-btn"
            onClick={() => {
              setPinMode('none');
              setPickingDestination(false);
              pickingDestinationRef.current = false;
              activeTargetRef.current = 'A';
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Button to reopen sidebar when collapsed */}
      {isSidebarCollapsed ? (
        <button
          className="sidebar-open-btn"
          type="button"
          onClick={() => setIsSidebarCollapsed(false)}
          title="Open AI & Time Travel Navigation"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span>AI & Time Travel</span>
        </button>
      ) : null}

      {/* Unified Left Navigation Bar housing AI Chatbot and Time Travel */}
      <aside
        id="left-nav-bar"
        ref={leftNavRef}
        className={[
          'left-nav-bar',
          'ai-panel',
          isSidebarCollapsed ? 'collapsed' : '',
          isFullSize ? 'expanded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Navigation Bar Header */}
        <div className="panel-header">
          <div className="panel-title-wrap">
            <div className="panel-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div className="project-title-group">
              <span className="project-title">Sime Darby GIS</span>
              <span className="project-subtitle">
                <span className="status-dot"></span> Abso AI Analyst
              </span>
            </div>
          </div>

          <div className="panel-actions">
            {/* Full-size toggle */}
            <button
              id="full-size-toggle"
              className="icon-btn"
              type="button"
              aria-label={isFullSize ? 'Return to regular layout' : 'Toggle full size panel'}
              title={isFullSize ? 'Compact view' : 'Full-screen view'}
              onClick={() => setIsFullSize((previousState) => !previousState)}
            >
              {isFullSize ? '⤡' : '⤢'}
            </button>

            {/* Collapse sidebar button */}
            <button
              id="sidebar-collapse-toggle"
              className="icon-btn"
              type="button"
              aria-label="Collapse navigation bar"
              title="Collapse sidebar to view full map"
              onClick={() => setIsSidebarCollapsed(true)}
            >
              ◀
            </button>
          </div>
        </div>

        {/* Navigation Bar Switcher: AI Chatbot, Time Travel, Sustainability, Setting */}
        <nav className="left-nav-tabs" aria-label="Sidebar Navigation">
          <button
            id="tab-btn-chat"
            type="button"
            className={activeNavTab === 'chat' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => {
              setActiveNavTab('chat');
              setPickingDestination(false);
              pickingDestinationRef.current = false;
              if (pinMode === 'destination') setPinMode('none');
            }}
          >
            AI Chatbot
          </button>

          <button
            id="tab-btn-travel"
            type="button"
            className={activeNavTab === 'travel' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => {
              setActiveNavTab('travel');
              setPickingDestination(false);
              pickingDestinationRef.current = false;
              if (pinMode === 'destination') setPinMode('none');
            }}
          >
            Time Travel
          </button>

          <button
            id="tab-btn-sustainability"
            type="button"
            className={activeNavTab === 'sustainability' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => setActiveNavTab('sustainability')}
          >
            Sustainability
          </button>

          <button
            id="tab-btn-settings"
            type="button"
            className={activeNavTab === 'settings' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => {
              setActiveNavTab('settings');
              setPickingDestination(false);
              pickingDestinationRef.current = false;
              if (pinMode === 'destination') setPinMode('none');
            }}
          >
            Setting
          </button>
        </nav>

        {/* Panel Body */}
        <div className="panel-body">
          {/* TAB 1: AI CHATBOT */}
          {activeNavTab === 'chat' ? (
            <div className="chat-container">

              {/* Chat Message Scroll */}

              <div className="panel-scroll">
                <div className="welcome-card">
                  <div className="welcome-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <h2>Welcome to Abso — AI GIS Analyst</h2>
                  <p>Ask about spatial patterns, reachable destinations, or site comparisons.</p>
                </div>

                {/* Prompt suggestion chips */}
                <div className="quick-prompts-wrap">
                  <span className="quick-prompts-label">Quick Insights</span>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() => handleSend(`What destinations are within a 15-minute walk of ${selectedLocation.name}?`)}
                  >
                    What is within a 15-minute walk?
                  </button>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() => handleSend('Analyze retail and shopping mall accessibility.')}
                  >
                    Analyze shopping mall accessibility
                  </button>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() => handleSend('Tell me about the transit hubs connected to this area.')}
                  >
                    Summarize connected transit hubs
                  </button>
                </div>

                <div className="message-list">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.sender}`}>
                      {message.text}
                    </div>
                  ))}
                  {isAiThinking ? (
                    <div className="message bot thinking">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>

                <div className="tips-card">
                  <div className="tips-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  </div>
                  <div className="tips-copy">
                    <h3>Pro-Tip: Interactive Layers</h3>
                    <p>Use the 'All' menu in the top bar to toggle places and see real-time map pins.</p>
                  </div>
                </div>
              </div>

              {/* Unobstructed Chat Input */}
              <div className="chat-input-shell">
                <textarea
                  id="ai-input"
                  rows="1"
                  placeholder="Ask Abso about the map or location insights..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button id="send-btn" className="send-btn" type="button" onClick={() => handleSend()}>
                  →
                </button>
              </div>
            </div>
          ) : activeNavTab === 'settings' ? (
            /* TAB 4: SETTINGS SECTION */
            <SettingsSection
              currentLocation={selectedLocation}
              onSelectLocation={(fav) => {
                setSelectedLocation(fav);
                setLocationAInput(fav.name);
                setAnalysisRun(false);
                setAnalysisResult(null);
                setComparisonResult(null);
                setIsSplitViewActive(false);
                mapFeatureRef.current?.clearIsochrone();
                mapFeatureRef.current?.clearComparison();
                mapFeatureRef.current?.updateOrigin(fav);
                mapFeatureRef.current?.map.flyTo({ center: fav.coords, zoom: 13, duration: 800 });
                currentOriginRef.current = fav;
              }}
              pinMode={pinMode}
              onStartPinBookmark={() => setPinMode('bookmark')}
              onTogglePinBookmark={() =>
                setPinMode((prev) => (prev === 'bookmark' ? 'none' : 'bookmark'))
              }
              favoritesTrigger={favoritesTrigger}
            />
          ) : activeNavTab === 'sustainability' ? (
            /* TAB 3: SUSTAINABILITY SECTION */
            <div className="sustainability-tab-content">
              <PlaceSearch onSelect={selectSustainabilityPlace} />
              <SustainabilityPanel
                origin={selectedLocation}
                destination={destination}
                picking={pickingDestination}
                onPick={toggleDestinationPick}
                onComparison={setCarbonComparison}
              />
            </div>
          ) : (
            /* TAB 2: TIME TRAVEL STUDIO */
            <div className="travel-studio">

              {/* Location Selection & Comparison */}
              <div className="studio-section">
                <span className="section-label location-label">Analysis Location</span>

                {/* Minimalist Pure Text Fields for Site A and Site B (Matching Image 1) */}
                <div className="site-pure-inputs-container">
                  {/* Row 1: Site A */}
                  <div className={`site-pure-input-row ${pinMode === 'A' ? 'pin-active' : ''}`}>
                    <input
                      type="text"
                      id="location-a-input"
                      className="site-pure-input-field"
                      placeholder="Find a place"
                      value={locationAInput}
                      onChange={(e) => setLocationAInput(e.target.value)}
                      onClick={() => {
                        activeTargetRef.current = 'A';
                        setPinMode('A');
                      }}
                      onFocus={() => {
                        activeTargetRef.current = 'A';
                        setPinMode('A');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchLocationA();
                        }
                      }}
                    />
                    <div className="site-pure-input-actions">
                      {isSearchingA ? (
                        <span className="site-searching-indicator">...</span>
                      ) : null}
                      <button
                        type="button"
                        className={`site-pure-icon-btn ${pinMode === 'A' ? 'active' : ''}`}
                        onClick={() => {
                          activeTargetRef.current = 'A';
                          setPinMode('A');
                        }}
                        title={pinMode === 'A' ? 'Pinning Location A' : 'Pin location on map'}
                      >
                        {/* Folded Map Icon (Image 1 style) */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Site B (When comparison is active) */}
                  {isComparing ? (
                    <div className={`site-pure-input-row secondary ${pinMode === 'B' ? 'pin-active' : ''}`}>
                      <input
                        type="text"
                        id="location-b-input"
                        className="site-pure-input-field"
                        placeholder="Find a place"
                        value={locationBInput}
                        onChange={(e) => setLocationBInput(e.target.value)}
                        onClick={() => {
                          activeTargetRef.current = 'B';
                          setPinMode('B');
                        }}
                        onFocus={() => {
                          activeTargetRef.current = 'B';
                          setPinMode('B');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchLocationB();
                          }
                        }}
                      />
                      <div className="site-pure-input-actions">
                        {isSearchingB ? (
                          <span className="site-searching-indicator">...</span>
                        ) : null}
                        <button
                          type="button"
                          className={`site-pure-icon-btn secondary ${pinMode === 'B' ? 'active' : ''}`}
                          onClick={() => {
                            activeTargetRef.current = 'B';
                            setPinMode('B');
                          }}
                          title={pinMode === 'B' ? 'Pinning Location B' : 'Pin comparison site on map'}
                        >
                          {/* Folded Map Icon (Image 1 style) */}
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="site-pure-icon-btn site-pure-trash-btn"
                          onClick={() => {
                            setIsComparing(false);
                            setPinMode('none');
                            activeTargetRef.current = 'A';
                            setComparisonResult(null);
                            setIsSplitViewActive(false);
                            mapFeatureRef.current?.clearComparison();
                            mapFeatureRef.current?.setComparisonMode(false);
                          }}
                          title="Remove comparison location"
                        >
                          {/* Trash Can Icon (Image 1 style) */}
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="add-place-input-btn"
                      className="add-place-input-btn"
                      onClick={() => {
                        setIsComparing(true);
                        activeTargetRef.current = 'B';
                        setPinMode('B');
                        mapFeatureRef.current?.setComparisonMode(true, selectedLocation, compareSiteB);
                        if (!locationBInput) {
                          setLocationBInput(compareSiteB.address || compareSiteB.name);
                        }
                      }}
                    >
                      <span>+</span>
                      <span>add place input</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="studio-section">
                <span className="section-label">Travel Mode</span>
                <div className="mode-grid">
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={travelMode === mode.id ? 'mode-card active' : 'mode-card'}
                      onClick={() => setTravelMode(mode.id)}
                    >
                      <span className="mode-card-icon">
                        {mode.id === 'walking' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="2"/><path d="m9 20 3-6 3 2 2 4"/><path d="m6 16 4-3 1.5 1.5"/><path d="m14 13 2-2"/></svg>
                        ) : mode.id === 'cycling' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9h3l2 3h3.5"/><path d="M5.5 17.5 9 9"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.7V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                        )}
                      </span>
                      <span className="mode-card-title">{mode.label}</span>
                      <span className="mode-card-sub">{mode.speed}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes Selection */}
              <div className="studio-section">
                <div className="section-label">
                  <span>Travel Duration</span>
                </div>
                <div className="minutes-grid">
                  {TRAVEL_MINUTES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className={[
                        'minute-card',
                        m.cardClass,
                        travelMinutes === m.value ? 'active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setTravelMinutes(m.value)}
                    >
                      <span className="minute-card-val">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>



              {/* After Analysis: Interactive Amenities Filter Button under Map Labels */}
              {(analysisRun || comparisonResult) && (
                <div className="studio-section amenity-chooser-section">
                  <button
                    id="choose-map-amenities-btn"
                    type="button"
                    className={`choose-map-amenities-btn ${showAmenityChooser ? 'active' : ''}`}
                    onClick={() => setShowAmenityChooser((prev) => !prev)}
                    title="Choose which amenities categories to show on map"
                  >
                    <div className="choose-btn-left">
                      <span className="choose-btn-icon">🏷️</span>
                      <span className="choose-btn-text">Choose Amenities on Map</span>
                    </div>
                    <span className="choose-btn-badge">
                      {selectedCategories.length} active {showAmenityChooser ? '▴' : '▾'}
                    </span>
                  </button>

                  {/* Amenities Category Filter Dropdown Panel */}
                  {showAmenityChooser && (
                    <div className="amenity-chooser-dropdown">
                      <div className="amenity-chooser-header">
                        <span className="chooser-header-title">Filter Visible Categories</span>
                        <div className="chooser-header-actions">
                          <button
                            type="button"
                            className="chooser-action-link"
                            onClick={selectAllCategories}
                          >
                            All ({ALL_CATEGORY_ITEMS.length})
                          </button>
                          <span className="chooser-divider">|</span>
                          <button
                            type="button"
                            className="chooser-action-link"
                            onClick={clearAllCategories}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="amenity-chooser-groups">
                        {CATEGORY_GROUPS.map((group) => {
                          const groupItemIds = group.items.map((i) => i.id);
                          const activeInGroup = groupItemIds.filter((id) => selectedCategories.includes(id)).length;
                          const isAllInGroup = activeInGroup === groupItemIds.length;
                          const isExpanded = expandedGroupIds.includes(group.id);

                          return (
                            <div key={group.id} className="amenity-chooser-group-card">
                              <div className="amenity-chooser-group-row">
                                <label className="chooser-group-check-label">
                                  <input
                                    type="checkbox"
                                    checked={isAllInGroup}
                                    ref={(el) => {
                                      if (el) el.indeterminate = activeInGroup > 0 && !isAllInGroup;
                                    }}
                                    onChange={() => toggleGroup(group.id)}
                                  />
                                  <span className="chooser-group-shape" style={{ color: group.color }}>
                                    {group.shapeSymbol}
                                  </span>
                                  <span className="chooser-group-name">{group.name}</span>
                                </label>
                                <div className="chooser-group-right">
                                  <span className="chooser-group-count">
                                    {activeInGroup}/{group.items.length}
                                  </span>
                                  <button
                                    type="button"
                                    className="chooser-group-expand-arrow"
                                    onClick={() => toggleGroupExpanded(group.id)}
                                    title="Toggle subcategories"
                                  >
                                    {isExpanded ? '▴' : '▾'}
                                  </button>
                                </div>
                              </div>

                              {/* Granular Subcategories Accordion */}
                              {isExpanded && (
                                <div className="amenity-chooser-subitems">
                                  {group.items.map((sub) => {
                                    const isSubChecked = selectedCategories.includes(sub.id);
                                    return (
                                      <label key={sub.id} className={`chooser-subitem-row ${isSubChecked ? 'active' : ''}`}>
                                        <input
                                          type="checkbox"
                                          checked={isSubChecked}
                                          onChange={() => toggleCategory(sub.id)}
                                        />
                                        <span className="chooser-subitem-shape" style={{ color: sub.color || group.color }}>
                                          {sub.shapeSymbol || group.shapeSymbol}
                                        </span>
                                        <span className="chooser-subitem-label">{sub.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Run Analysis / Dual Comparison Button */}
              <button
                id="run-analysis-btn"
                type="button"
                className={`run-analysis-btn${(analysisRun || comparisonResult) ? ' analysis-active' : ''}${analysisLoading || comparisonLoading ? ' loading' : ''}`}
                onClick={isComparing ? handleRunComparison : handleRunAnalysis}
                disabled={analysisLoading || comparisonLoading}
              >
                {analysisLoading || comparisonLoading
                  ? 'Calculating Google Places Reach...'
                  : isComparing
                  ? comparisonResult
                    ? 'Dual Analysis Active — Re-run'
                    : '▶ Run Dual Comparison'
                  : analysisRun
                  ? 'Analysis Active — Re-run'
                  : '▶ Run Analysis'}
              </button>

              {/* DUAL SITE COMPARISON RESULTS */}
              {isComparing && comparisonResult ? (
                <div className="compare-results-card">
                  {/* 1. Brief Category Breakdown FIRST */}
                  <div className="brief-category-summary">
                    <div className="brief-category-header">
                      <span className="brief-category-title">Category Breakdown (Site A vs Site B)</span>
                      <span className="brief-category-count">{comparisonResult.statsA?.total || 0} vs {comparisonResult.statsB?.total || 0}</span>
                    </div>
                    <div className="brief-category-tags">
                      {comparisonResult.categoryComparisons.map((row) => (
                        <div key={row.id} className="brief-category-tag" title={`${row.label}: Site A has ${row.countA}, Site B has ${row.countB}`}>
                          <div className="brief-cat-left">
                            <span className="brief-cat-shape" style={{ color: row.color }}>
                              {row.shape === 'circle' ? '●' : row.shape === 'triangle' ? '▲' : row.shape === 'star' ? '★' : row.shape === 'hexagon' ? '⬢' : row.shape === 'diamond' ? '◆' : '■'}
                            </span>
                            <span className="brief-cat-name">{row.label}</span>
                          </div>
                          <div className="brief-cat-right">
                            <span className="brief-cat-num">{row.countA} / {row.countB}</span>
                            <span
                              className={`comp-delta-badge ${
                                row.advantage === 'siteB'
                                  ? 'site-b-wins'
                                  : row.advantage === 'siteA'
                                  ? 'site-a-wins'
                                  : 'tie'
                              }`}
                              style={{ fontSize: '0.62rem', padding: '1px 4px', marginLeft: 2 }}
                            >
                              {row.diff > 0 ? `+${row.diff}B` : row.diff < 0 ? `+${Math.abs(row.diff)}A` : '='}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Split Screen Compare Button */}
                  <button
                    type="button"
                    id="btn-split-screen-compare"
                    className={`split-screen-toggle-btn ${isSplitViewActive ? 'active' : ''}`}
                    onClick={handleToggleSplitScreen}
                  >
                    <span style={{ fontSize: '1rem' }}>◫</span>
                    <span>{isSplitViewActive ? 'Exit Split Screen' : 'Split Screen Comparison (Left / Right)'}</span>
                  </button>



                  {/* 4. Winner Banner */}
                  <div className="winner-banner">
                    <span>★</span>
                    <span>{comparisonResult.winnerText}</span>
                  </div>

                  {/* 5. Dual Score Cards */}
                  <div className="comparison-grid">
                    <div className="comp-col-card site-a">
                      <span className="comp-col-title">📍 {comparisonResult.siteA.name}</span>
                      <div className="comp-score-large">
                        {comparisonResult.densityA?.score ?? 0}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>/100</span>
                      </div>
                      <div className="comp-stat-sub">
                        {comparisonResult.densityA?.rating || 'Fair'} • {comparisonResult.statsA?.total || 0} amenities
                      </div>
                      <div className="comp-stat-sub">
                        Density: {comparisonResult.densityA?.densityPerKm2 || 0} /km²
                      </div>
                    </div>

                    <div className="comp-col-card site-b">
                      <span className="comp-col-title">📍 {comparisonResult.siteB.name}</span>
                      <div className="comp-score-large">
                        {comparisonResult.densityB?.score ?? 0}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>/100</span>
                      </div>
                      <div className="comp-stat-sub">
                        {comparisonResult.densityB?.rating || 'Fair'} • {comparisonResult.statsB?.total || 0} amenities
                      </div>
                      <div className="comp-stat-sub">
                        Density: {comparisonResult.densityB?.densityPerKm2 || 0} /km²
                      </div>
                    </div>
                  </div>

                  {/* 6. Strategic Takeaways */}
                  <div className="comparison-table-wrap">
                    <span className="comparison-table-title">Strategic Insights</span>
                    <div className="takeaway-list">
                      {comparisonResult.takeaways.map((tip, idx) => (
                        <div key={idx} className="takeaway-item">{tip}</div>
                      ))}
                    </div>
                  </div>

                  {/* 7. Export Comparative PDF Report */}
                  <button
                    type="button"
                    className="export-pdf-action-btn"
                    onClick={() => handleExport('pdf')}
                    title="Export comparison report"
                  >
                    <span>Export Comparison PDF Report</span>
                  </button>
                </div>
              ) : null}

              {/* SINGLE SITE ANALYSIS RESULTS */}
              {!isComparing && analysisRun ? (
                <div className="travel-metrics-card">
                  {/* 1. Brief Category Breakdown FIRST */}
                  {analysisResult?.typeBreakdown?.length ? (
                    <div className="brief-category-summary">
                      <div className="brief-category-header">
                        <span className="brief-category-title">Category Breakdown</span>
                        <span className="brief-category-count">{analysisResult.total} places</span>
                      </div>
                      <div className="brief-category-tags">
                        {analysisResult.typeBreakdown.map((item) => (
                          <div key={item.id} className="brief-category-tag">
                            <div className="brief-cat-left">
                              <span
                                className="brief-cat-shape"
                                style={{ color: item.color }}
                              >
                                {item.shapeSymbol || '●'}
                              </span>
                              <span className="brief-cat-name">{item.label}</span>
                            </div>
                            <span className="brief-cat-num">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}



                  {/* Trustworthy Spatial Density & 15-Minute City Score Badge */}
                  {densityScore ? (
                    <div className="density-score-card">
                      <div className="density-header">
                        <span className="density-title">Density Score</span>
                        <span className="density-badge" style={{ backgroundColor: densityScore.badgeColor }}>
                          {densityScore.score} / 100
                        </span>
                      </div>
                      <div className="density-stats-grid">
                        <div className="density-stat">
                          <span className="density-stat-num">{densityScore.densityPerKm2}</span>
                          <span className="density-stat-lbl">places / km²</span>
                        </div>
                        <div className="density-stat">
                          <span className="density-stat-num">{densityScore.areaKm2}</span>
                          <span className="density-stat-lbl">catchment km²</span>
                        </div>
                        <div className="density-stat">
                          <span className="density-stat-num">{densityScore.diversityIndex}</span>
                          <span className="density-stat-lbl">diversity</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Clean PDF Export Action Button */}
                  <button
                    type="button"
                    className="export-pdf-action-btn"
                    onClick={() => handleExport('pdf')}
                    title="Export clean executive analysis report with map, counts and amenities"
                  >
                    <span>Export Analysis PDF Report</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {/* Top Action Bar */}
      <div className={['top-actions', isSidebarCollapsed ? 'sidebar-hidden' : ''].filter(Boolean).join(' ')}>
        {/* All Categories Multi-Selection Button & Popover (Previous Design) */}
        <div className="all-picker" ref={allMenuRef}>
          <button
            id="all-toggle"
            name="all-toggle"
            type="button"
            className={['category-horizontal-tile', 'main-cat-tile', 'all-btn', allMenuOpen ? 'active open' : ''].join(' ')}
            onClick={() => setAllMenuOpen((prev) => !prev)}
            aria-expanded={allMenuOpen}
            aria-haspopup="true"
            aria-label="All categories with multi-selection"
            title="All categories and subcategories selection"
          >
            <span>📂</span>
            <span>All</span>
            {selectedCategories.length > 0 ? (
              <span className="all-badge">{selectedCategories.length}</span>
            ) : null}
            <span className="chevron-arrow">{allMenuOpen ? '▲' : '▼'}</span>
          </button>

          {/* Categorized Multi-Selection Dropdown Popover */}
          {allMenuOpen ? (
            <div className="all-multi-menu" role="dialog" aria-label="All Categories Multi-selection">
              {/* Menu Header with Search & Global Actions */}
              <div className="all-menu-header">
                <div className="menu-header-top">
                  <div className="menu-title-wrap">
                    <span className="menu-title">All Categories</span>
                    <span className="selection-count-tag">
                      {selectedCategories.length} of {ALL_CATEGORY_ITEMS.length} selected
                    </span>
                  </div>

                  <div className="menu-header-actions">
                    <button
                      type="button"
                      className="menu-action-btn"
                      onClick={selectAllCategories}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="menu-action-btn"
                      onClick={clearAllCategories}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Categorized Groups with Multi-Selection Checkboxes */}
              <div className="all-menu-body">
                {CATEGORY_GROUPS.map((group) => {
                  const groupItemIds = group.items.map((i) => i.id);
                    const allGroupChecked = groupItemIds.every((id) =>
                      selectedCategories.includes(id)
                    );

                    return (
                      <div key={group.id} className="category-group-card">
                        <div className="category-group-header">
                          <div className="group-header-left">
                            <span style={{ color: group.color }}>{group.shapeSymbol || '●'}</span>
                            <span>{group.name}</span>
                            <span className="group-count-badge">({group.items.length})</span>
                          </div>

                          <button
                            type="button"
                            className="group-toggle-btn"
                            onClick={() => toggleGroup(group.id)}
                          >
                            {allGroupChecked ? 'Deselect group' : 'Select all'}
                          </button>
                        </div>

                        <div className="category-items-grid">
                          {group.items.map((item) => {
                            const isChecked = selectedCategories.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className={`category-checkbox-chip ${isChecked ? 'checked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCategory(item.id)}
                                />
                                <span
                                  className="chip-color-dot"
                                  style={{ background: item.color }}
                                />
                                <span className="chip-label" title={item.label}>
                                  {item.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Scrollable Horizontal Main Category Buttons (No numbers inside, white style like Export) */}
        <div
          ref={categoryStripRef}
          className="categories-horizontal-strip"
          role="toolbar"
          aria-label="Main categories selection"
          onMouseDown={handleCategoryStripMouseDown}
          onMouseMove={handleCategoryStripMouseMove}
          onMouseUp={handleCategoryStripMouseUpOrLeave}
          onMouseLeave={handleCategoryStripMouseUpOrLeave}
          onWheel={handleCategoryStripWheel}
        >
          {CATEGORY_GROUPS.map((group) => {
            const groupItemIds = group.items.map((i) => i.id);
            const activeCount = groupItemIds.filter((id) => selectedCategories.includes(id)).length;
            const isAllActive = activeCount === groupItemIds.length;
            const isPartial = activeCount > 0 && !isAllActive;

            return (
              <button
                key={group.id}
                type="button"
                className={`category-horizontal-tile main-cat-tile ${isAllActive ? 'active' : isPartial ? 'partial' : ''}`}
                onClick={() => {
                  if (isStripDraggingRef.current) return;
                  toggleGroup(group.id);
                }}
                title={`Toggle ${group.name}`}
              >
                <span
                  className="cat-tile-shape"
                  style={{ color: group.color }}
                >
                  {group.shapeSymbol || '●'}
                </span>
                <span className="cat-tile-label">{group.name}</span>
              </button>
            );
          })}
        </div>

        {/* 2D / 3D View Toggle */}
        <div className="view-toggle-wrap">
          <button
            id="view-toggle"
            className="view-toggle"
            type="button"
            aria-label="Toggle 2D or 3D map view"
            onClick={toggleMapMode}
          >
            {mapMode === '2d' ? '2D View' : '3D View'}
          </button>
        </div>

        {/* Export Menu */}
        <div className="export-wrap">
          <button
            id="export-toggle"
            className="export-btn"
            type="button"
            onClick={() => setExportMenuOpen((previousState) => !previousState)}
          >
            Export ▾
          </button>

          <div id="export-menu" className={exportMenuOpen ? 'export-menu open' : 'export-menu'}>
            <button type="button" onClick={() => handleExport('png')}>PNG Map Image</button>
            <button type="button" onClick={() => handleExport('pdf')}>PDF Map Report</button>
            <button type="button" onClick={() => handleExport('csv')}>CSV Filtered Places</button>
          </div>
        </div>
      </div>

      {/* Map Overlay Badge */}
      <div className="overlay">
        <div className="badge">{mapMode === '2d' ? 'PURE 2D MAP' : '3D PERSPECTIVE MAP'}</div>
        <h1>{selectedLocation.name}</h1>
        <div className="overlay-tags">
          <span className="overlay-tag">
            {activeTravelModeObj.label} · {travelMinutes} min
          </span>
          <span className="overlay-tag">
            {selectedCategories.length} categories active
          </span>
        </div>
      </div>

      {/* Error notification if any */}
      {errorMessage ? (
        <div ref={mapErrorRef} className="map-error">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
