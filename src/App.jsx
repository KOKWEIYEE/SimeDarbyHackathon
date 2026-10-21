import { useEffect, useMemo, useRef, useState } from "react";
import "./features/ai/styles.css";
import SustainabilityPanel from "./features/sustainability/Panel.jsx";
import mapboxgl from "mapbox-gl";
import PlaceSearch from "./features/map/PlaceSearch.jsx";
import MessageText from "./features/ai/MessageText.jsx";
import { resolveRouteAction } from "./features/ai/routeAction.js";
import { initMapFeature } from "./features/map/index.js";
import {
  CATEGORY_GROUPS,
  ALL_CATEGORY_ITEMS,
  PRESET_LOCATIONS,
  PLACES_DATA,
} from "./features/map/placesData.js";

const TRAVEL_MODES = [
  {
    id: "walking",
    label: "Walk",
    icon: "🚶",
    speed: "4.5 km/h",
    desc: "Pedestrian paths & sidewalks",
  },
  {
    id: "cycling",
    label: "Bike",
    icon: "🚲",
    speed: "15 km/h",
    desc: "Bike lanes & secondary roads",
  },
  {
    id: "driving",
    label: "Drive",
    icon: "🚗",
    speed: "Live road",
    desc: "Real-time road network routing",
  },
];

const TRAVEL_MINUTES = [
  {
    value: 10,
    label: "10 min",
    color: "#22c55e",
    dotClass: "c-10",
    cardClass: "m-10",
  },
  {
    value: 20,
    label: "20 min",
    color: "#eab308",
    dotClass: "c-20",
    cardClass: "m-20",
  },
  {
    value: 30,
    label: "30 min",
    color: "#f97316",
    dotClass: "c-30",
    cardClass: "m-30",
  },
];

const INITIAL_SELECTED_CATEGORIES = [
  "restaurant",
  "cafe",
  "mall",
  "grocery",
  "lrt-station",
  "train-station",
  "bus-station",
  "monorail-station",
  "kindergarten",
  "primary-school",
  "secondary",
  "university",
  "tuition-centre",
];

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
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
  const destinationPickRef = useRef(false);
  const destinationMarkerRef = useRef(null);
  const [destination, setDestination] = useState(null);
  const [carbonComparison,setCarbonComparison] = useState(null);
  const [chatRoute,setChatRoute] = useState(null);
  const endpointRevision = useRef(0);
  const [pickingDestination, setPickingDestination] = useState(false);

  // Left Navigation Bar state
  const [activeNavTab, setActiveNavTab] = useState("chat"); // 'chat' | 'travel'
  useEffect(()=>{
    if(activeNavTab !== "sustainability"){
      destinationPickRef.current=false;
      setPickingDestination(false);
    }
  },[activeNavTab]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullSize, setIsFullSize] = useState(false);

  // Location selection state
  const [selectedLocation, setSelectedLocation] = useState(PRESET_LOCATIONS[0]);
  useEffect(()=>{endpointRevision.current+=1;},[selectedLocation,destination]);
  useEffect(()=>{
    const map=mapFeatureRef.current?.map;
    if(!map)return;
    const draw=()=>{
      if(!map.isStyleLoaded())return;
      const matches=chatRoute&&JSON.stringify(chatRoute.origin.coords)===JSON.stringify(selectedLocation.coords)
        &&JSON.stringify(chatRoute.destination.coords)===JSON.stringify(destination?.coords);
      const geometry=matches?chatRoute.route.geometry:null;
      const data={type:'FeatureCollection',features:geometry?[{type:'Feature',properties:{},geometry}]:[]};
      if(map.getSource('assistant-route'))map.getSource('assistant-route').setData(data);
      else {
        map.addSource('assistant-route',{type:'geojson',data});
        map.addLayer({id:'assistant-route',type:'line',source:'assistant-route',
          paint:{'line-color':'#16845a','line-width':5}});
      }
    };
    draw();map.on('style.load',draw);
    return()=>map.off('style.load',draw);
  },[chatRoute,selectedLocation,destination]);

  // Map and Travel state
  const [mapMode, setMapMode] = useState("2d");
  const [errorMessage, setErrorMessage] = useState("");
  const [travelMode, setTravelMode] = useState("walking");
  const [travelMinutes, setTravelMinutes] = useState(20);
  // Track whether analysis has been run and analysis result
  const [analysisRun, setAnalysisRun] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showLabels, setShowLabels] = useState(true);

  // Categorized Multi-selection state
  const [allMenuOpen, setAllMenuOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(
    INITIAL_SELECTED_CATEGORIES,
  );
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // Top action menus & Chat state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Welcome to Abso — your AI GIS analyst. Ask about the map, location insights, time-travel reach, or category filters.",
    },
  ]);

  // Initialize Mapbox feature
  useEffect(() => {
    const apiKey = (import.meta.env.VITE_MAPBOX_API_KEY ?? "").trim();

    if (!apiKey) {
      setErrorMessage("Missing VITE_MAPBOX_API_KEY in your .env file.");
      return undefined;
    }

    const googleApiKey = (
      import.meta.env.VITE_GOOGLE_API_KEY ||
      import.meta.env.GOOGLE_API_KEY ||
      ""
    ).trim();

    const feature = initMapFeature({
      apiKey,
      googleApiKey,
      mapContainerRef,
      errorBoxRef: mapErrorRef,
      onModeChange: setMapMode,
      onLocationPick: (customLoc) => {
        if (destinationPickRef.current) {
          destinationPickRef.current = false;
          setPickingDestination(false);
          setDestination(customLoc);
          destinationMarkerRef.current?.remove();
          destinationMarkerRef.current = new mapboxgl.Marker({color:'#187b59'})
            .setLngLat(customLoc.coords).addTo(feature.map);
          return;
        }
        // Move origin pin to clicked location; don't auto-run isochrone
        setSelectedLocation(customLoc);
        setAnalysisRun(false);
        setAnalysisResult(null);
        feature.clearIsochrone();
        feature.updateOrigin(customLoc);
        currentOriginRef.current = customLoc;
      },
    });

    mapFeatureRef.current = feature;

    // DO NOT label amenities at default! Map remains clean with only origin pin.
    return () => {
      destinationMarkerRef.current?.remove();
      feature.map.remove();
    };
  }, []);

  // When mode/minutes change while analysis is active, reset so user must re-run
  useEffect(() => {
    if (analysisRun) {
      setAnalysisRun(false);
      setAnalysisResult(null);
      mapFeatureRef.current?.clearIsochrone();
    }
  }, [travelMode, travelMinutes]);

  // Update POI markers on map when multi-selection changes (only if analysis is active)
  useEffect(() => {
    if (analysisRun) {
      mapFeatureRef.current?.updatePOIs(selectedCategories);
    }
  }, [selectedCategories, analysisRun]);

  // Handle outside clicks to close menus
  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (
        !target.closest(".export-menu") &&
        !target.closest("#export-toggle")
      ) {
        setExportMenuOpen(false);
      }

      if (
        !target.closest(".all-multi-menu") &&
        !target.closest("#all-toggle") &&
        !target.closest("#shop-toggle")
      ) {
        setAllMenuOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, activeNavTab]);

  const toggleMapMode = () => {
    if (!mapFeatureRef.current) return;
    const nextMode = mapMode === "2d" ? "3d" : "2d";
    mapFeatureRef.current.applyMapView(nextMode);
    setMapMode(nextMode);
  };

  // Multi-selection helper functions
  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const toggleGroup = (groupId) => {
    const group = CATEGORY_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const groupItemIds = group.items.map((i) => i.id);
    const allChecked = groupItemIds.every((id) =>
      selectedCategories.includes(id),
    );

    if (allChecked) {
      setSelectedCategories((prev) =>
        prev.filter((id) => !groupItemIds.includes(id)),
      );
    } else {
      setSelectedCategories((prev) =>
        Array.from(new Set([...prev, ...groupItemIds])),
      );
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
        (item) =>
          item.label.toLowerCase().includes(query) ||
          group.name.toLowerCase().includes(query),
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

    if (type === "png") {
      const canvas = await window.html2canvas(document.getElementById("map"));
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, "sime-darby-map.png");
        }
      }, "image/png");
      return;
    }

    if (type === "pdf") {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("landscape", "pt", "a4");
      const canvas = await window.html2canvas(document.getElementById("map"));
      const imageData = canvas.toDataURL("image/png");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imageData, "PNG", 20, 20, pageWidth - 40, pageHeight - 40);
      pdf.save("sime-darby-map.pdf");
      return;
    }

    if (type === "csv") {
      const rows = [
        "title,category,address,longitude,latitude",
        ...PLACES_DATA.filter((p) =>
          selectedCategories.includes(p.categoryId),
        ).map(
          (p) =>
            `"${p.name}","${p.categoryId}","${p.address}",${p.coords[0]},${p.coords[1]}`,
        ),
      ];

      downloadBlob(
        new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" }),
        "sime-darby-places.csv",
      );
    }
  };

  const [chatBusy,setChatBusy] = useState(false);
  const chatBusyRef = useRef(false);
  const handleSend = async (textToSend = null) => {
    const question = (textToSend ?? draft).trim();
    if (!question || chatBusyRef.current) return;
    chatBusyRef.current=true;setChatBusy(true);
    const revision=endpointRevision.current;
    const history=messages.filter(m=>(m.sender==='user'||m.sender==='bot')&&m.id!==1)
      .slice(-12).map(m=>({role:m.sender==='user'?'user':'assistant',content:(m.text+(m.instructions?.length?'\nProvider itinerary:\n'+m.instructions.join('\n'):'')).slice(0,8000)}));
    const context={origin:selectedLocation,destination,travelMode,travelMinutes,
      sustainability:carbonComparison&&JSON.stringify(carbonComparison.origin)===JSON.stringify(selectedLocation.coords)&&JSON.stringify(carbonComparison.destination)===JSON.stringify(destination?.coords)?carbonComparison:null,
      selectedCategories,analysis:analysisRun?analysisResult:null,
      note:'Client analysis snapshot; may include curated records. Not a field survey.'};
    setMessages(m=>[...m,{id:Date.now(),sender:'user',text:question}]);setDraft('');
    try {
      const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:question,history,context}),signal:AbortSignal.timeout(50000)});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof data?.detail==='string'?data.detail:'AI service unavailable. Check the Python backend.');
      if(!data?.response_text)throw new Error('AI returned an empty reply. Please retry.');
      setMessages(m=>[...m,{id:Date.now()+1,sender:'bot',text:data.response_text}]);
      if(data.action){
        const resolved=await resolveRouteAction(data.action,{
          mapbox:(import.meta.env.VITE_MAPBOX_API_KEY||'').trim(),
          google:(import.meta.env.VITE_GOOGLE_API_KEY||import.meta.env.GOOGLE_API_KEY||'').trim()});
        if(endpointRevision.current!==revision)throw new Error('The selected location changed during the request. Please ask again for the new location.');
        const feature=mapFeatureRef.current;
        const from={...resolved.origin,id:'chat-origin'};
        const to={...resolved.destination,id:'chat-destination'};
        setSelectedLocation(from);currentOriginRef.current=from;setDestination(to);
        setAnalysisRun(false);setAnalysisResult(null);feature?.clearIsochrone();feature?.updateOrigin(from);
        destinationPickRef.current=false;setPickingDestination(false);
        destinationMarkerRef.current?.remove();
        if(feature){
          destinationMarkerRef.current=new mapboxgl.Marker({color:'#187b59'}).setLngLat(to.coords).addTo(feature.map);
          const bounds=new mapboxgl.LngLatBounds(from.coords,to.coords);
          resolved.route.geometry?.coordinates.forEach(c=>bounds.extend(c));
          const width=feature.map.getContainer().clientWidth;
          feature.map.fitBounds(bounds,{padding:{top:60,bottom:60,left:width>900&&!isSidebarCollapsed?460:40,right:40},maxZoom:15});
        }
        setChatRoute(resolved);
        const r=resolved.route;
        const text=`Matched starting point: ${from.name}\nMatched destination: ${to.name}\n`+
          (r.status==='available'
          ? `${data.action.mode}: ${(r.distance/1000).toFixed(2)} km, about ${Math.round(r.duration/60)} minutes.\nSource: ${r.source}. These are route estimates, not live GPS guidance. Please check the matched places and entrances.`
          : `Route unavailable: ${r.reason}`);
        setMessages(m=>[...m,{id:Date.now()+2,sender:'bot',text,instructions:r.instructions}]);
      }
    }catch(error){
      setMessages(m=>[...m,{id:Date.now()+1,sender:'error',text:error.name==='TimeoutError'?'AI request timed out. Please retry.':error.message}]);
      setDraft(question);
    }finally{chatBusyRef.current=false;setChatBusy(false);}
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleRunAnalysis = async () => {
    if (!mapFeatureRef.current) return;

    setAnalysisLoading(true);
    setErrorMessage("");

    try {
      const res = await mapFeatureRef.current.runAnalysis({
        origin: selectedLocation,
        mode: travelMode,
        minutes: travelMinutes,
        selectedCategoryIds: selectedCategories,
      });

      setAnalysisRun(true);
      setAnalysisResult(res);
    } catch (err) {
      console.error("Isochrone analysis error:", err);
      setErrorMessage(
        err.message || "Analysis failed. Please check network and API keys.",
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const activeTravelModeObj =
    TRAVEL_MODES.find((mode) => mode.id === travelMode) ?? TRAVEL_MODES[0];
  const activeMinutesObj =
    TRAVEL_MINUTES.find((m) => m.value === travelMinutes) ?? TRAVEL_MINUTES[1];

  const reachablePlacesCount = useMemo(() => {
    return PLACES_DATA.filter((p) => selectedCategories.includes(p.categoryId))
      .length;
  }, [selectedCategories]);

  return (
    <div id="app" ref={appRef} className={isFullSize ? "chat-only" : ""}>
      {/* Map container */}
      <div id="map" ref={mapContainerRef} />

      {/* Floating Analysis Loading Indicator */}
      {analysisLoading ? (
        <div className="analysis-loading-banner">
          <div className="loading-spinner" />
          <span>
            Searching Google Places within {travelMinutes}-minute{" "}
            {activeTravelModeObj.label.toLowerCase()} reach...
          </span>
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
          <span>☰</span>
          <span>AI & Time Travel</span>
        </button>
      ) : null}

      {/* Unified Left Navigation Bar housing AI Chatbot and Time Travel */}
      <aside
        id="left-nav-bar"
        ref={leftNavRef}
        className={[
          "left-nav-bar",
          "ai-panel",
          isSidebarCollapsed ? "collapsed" : "",
          isFullSize ? "expanded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Navigation Bar Header */}
        <div className="panel-header">
          <div className="panel-title-wrap">
            <div className="panel-icon">⚡</div>
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
              aria-label={
                isFullSize
                  ? "Return to regular layout"
                  : "Toggle full size panel"
              }
              title={isFullSize ? "Compact view" : "Full-screen view"}
              onClick={() => setIsFullSize((previousState) => !previousState)}
            >
              {isFullSize ? "⤡" : "⤢"}
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

        {/* Navigation Bar Switcher: AI Chatbot & Time Travel */}
        <nav className="left-nav-tabs" aria-label="Sidebar Navigation">
          <button type="button"
            className={activeNavTab === "sustainability" ? "nav-tab-btn active" : "nav-tab-btn"}
            onClick={()=>setActiveNavTab("sustainability")}>Sustainability</button>
          <button
            id="tab-btn-chat"
            type="button"
            className={
              activeNavTab === "chat" ? "nav-tab-btn active" : "nav-tab-btn"
            }
            onClick={() => setActiveNavTab("chat")}
          >
            AI Chatbot
          </button>

          <button
            id="tab-btn-travel"
            type="button"
            className={
              activeNavTab === "travel" ? "nav-tab-btn active" : "nav-tab-btn"
            }
            onClick={() => setActiveNavTab("travel")}
          >
            Time Travel
          </button>
        </nav>

        {/* Panel Body */}
        <div className="panel-body">
          <PlaceSearch onSelect={(place,target)=>{
            const location={...place,id:'searched',name:place.shortName};
            const feature=mapFeatureRef.current;
            destinationPickRef.current=false;setPickingDestination(false);
            if(target==='destination'){
              setDestination(location);setActiveNavTab('sustainability');
              destinationMarkerRef.current?.remove();
              if(feature)destinationMarkerRef.current=new mapboxgl.Marker({color:'#187b59'}).setLngLat(place.coords).addTo(feature.map);
            }else{
              setSelectedLocation(location);currentOriginRef.current=location;
              setAnalysisRun(false);setAnalysisResult(null);
              feature?.clearIsochrone();feature?.updateOrigin(location);
            }
            feature?.map.flyTo({center:place.coords,zoom:15});
          }}/>
          {/* TAB 1: AI CHATBOT */}
          {activeNavTab === "sustainability" ? <SustainabilityPanel
            origin={selectedLocation} destination={destination} picking={pickingDestination} onComparison={setCarbonComparison}
            onPick={()=>{destinationPickRef.current=!destinationPickRef.current;setPickingDestination(destinationPickRef.current);}}
          /> : activeNavTab === "chat" ? (
            <div className="chat-container">
              {/* Chat Message Scroll */}

              <div className="panel-scroll">
                <div className="welcome-card">
                  <div className="welcome-icon">⚡</div>
                  <h2>Welcome to Abso — AI GIS Analyst</h2>
                  <p>
                    Ask about spatial patterns, reachable destinations, or
                    export current map data.
                  </p>
                </div>

                {/* Prompt suggestion chips */}
                <div className="quick-prompts-wrap">
                  <span className="quick-prompts-label">Quick Insights</span>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() =>
                      handleSend(
                        `What destinations are within a 15-minute walk of ${selectedLocation.name}?`,
                      )
                    }
                  >
                    <span>🚶</span> What is within a 15-minute walk?
                  </button>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() =>
                      handleSend(
                        "Analyze retail and shopping mall accessibility.",
                      )
                    }
                  >
                    <span>🛍️</span> Analyze shopping mall accessibility
                  </button>
                  <button
                    type="button"
                    className="prompt-chip"
                    onClick={() =>
                      handleSend(
                        "Tell me about the transit hubs connected to this area.",
                      )
                    }
                  >
                    <span>🚇</span> Summarize connected transit hubs
                  </button>
                </div>

                <div className="message-list">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${message.sender}`}
                    >
                      <MessageText text={message.text}/>
                      {message.instructions?.length>0&&<details open><summary>Provider route directions</summary>
                        <ol>{message.instructions.map((step,i)=><li key={i}>{step}</li>)}</ol>
                      </details>}
                    </div>
                  ))}
                  {chatBusy && <p role="status">Gemini is analysing your question...</p>}
                  <div ref={messagesEndRef} />
                </div>

                <div className="tips-card">
                  <div className="tips-icon">📖</div>
                  <div className="tips-copy">
                    <h3>Pro-Tip: Interactive Layers</h3>
                    <p>
                      Use the 'All' menu in the top bar to toggle places and see
                      real-time map pins.
                    </p>
                  </div>
                </div>
              </div>

              {/* Unobstructed Chat Input */}
              <div className="chat-input-shell">
                <textarea
                  id="ai-input"
                  maxLength={4000}
                  disabled={chatBusy}
                  rows="1"
                  placeholder="Ask Abso about the map or location insights..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  id="send-btn"
                  disabled={chatBusy || !draft.trim()}
                  aria-label="Send to Gemini"
                  className="send-btn"
                  type="button"
                  onClick={() => handleSend()}
                >
                  →
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: TIME TRAVEL STUDIO */
            <div className="travel-studio">
              {/* Location Selection */}
              <div className="studio-section">
                <span className="section-label">Analysis Location</span>
                <div className="location-select-wrap">
                  <select
                    id="travel-location-select"
                    className="location-select"
                    value={selectedLocation.id}
                    onChange={(e) => {
                      const found = PRESET_LOCATIONS.find(
                        (l) => l.id === e.target.value,
                      );
                      if (found) {
                        setSelectedLocation(found);
                        setAnalysisRun(false);
                        setAnalysisResult(null);
                        mapFeatureRef.current?.clearIsochrone();
                        mapFeatureRef.current?.updateOrigin(found);
                        if (mapFeatureRef.current) {
                          mapFeatureRef.current.map.flyTo({
                            center: found.coords,
                            duration: 700,
                          });
                        }
                        currentOriginRef.current = found;
                      }
                    }}
                  >
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                    {selectedLocation.id === "custom" ? (
                      <option value="custom">{selectedLocation.name}</option>
                    ) : null}
                  </select>
                </div>
                <span className="location-hint">
                  Or click anywhere on the map to pin a custom location
                </span>
              </div>

              {/* Mode Selection */}
              <div className="studio-section">
                <span className="section-label">Travel Mode</span>
                <div className="mode-grid">
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={
                        travelMode === mode.id
                          ? "mode-card active"
                          : "mode-card"
                      }
                      onClick={() => setTravelMode(mode.id)}
                    >
                      <span className="mode-card-icon">{mode.icon}</span>
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
                  <span style={{ color: activeMinutesObj.color }}>
                    {travelMinutes} min
                  </span>
                </div>
                <div className="minutes-grid">
                  {TRAVEL_MINUTES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className={[
                        "minute-card",
                        m.cardClass,
                        travelMinutes === m.value ? "active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setTravelMinutes(m.value)}
                    >
                      <span className="minute-card-val">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Map Labels Display Toggle */}
              <div className="studio-section">
                <span className="section-label">Map Labels</span>
                <button
                  id="toggle-labels-btn"
                  type="button"
                  className={`labels-toggle-btn ${showLabels ? "active" : ""}`}
                  onClick={() => {
                    const next = !showLabels;
                    setShowLabels(next);
                    mapFeatureRef.current?.toggleLabels(next);
                  }}
                >
                  <span>
                    {showLabels
                      ? "🏷️ Place Names: Shown"
                      : "⚪ Place Names: Hidden (Dots Only)"}
                  </span>
                </button>
              </div>

              {/* Run Analysis Button */}
              <button
                id="run-analysis-btn"
                type="button"
                className={`run-analysis-btn${analysisRun ? " analysis-active" : ""}${analysisLoading ? " loading" : ""}`}
                onClick={handleRunAnalysis}
                disabled={analysisLoading}
              >
                {analysisLoading
                  ? "⏳ Querying Google Places..."
                  : analysisRun
                    ? "✓ Analysis Active — Re-run"
                    : "▶ Run Analysis"}
              </button>

              {/* Status info when analysis is active */}
              {analysisRun ? (
                <div className="travel-metrics-card">
                  <div className="metric-row">
                    <span className="metric-name">📍 Origin</span>
                    <span className="metric-value">
                      {selectedLocation.name}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-name">🚀 Mode</span>
                    <span className="metric-value">
                      {activeTravelModeObj.label} · {travelMinutes} min
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-name">🏷️ Labeled Places</span>
                    <span
                      className="metric-value"
                      style={{ color: "#0f172a", fontWeight: 700 }}
                    >
                      {analysisResult?.total ?? 0} places (
                      {analysisResult?.source || "Google Places"})
                    </span>
                  </div>

                  {analysisResult?.typeBreakdown?.length ? (
                    <div className="amenities-breakdown-section">
                      <div className="breakdown-header">
                        <span className="breakdown-title">
                          Amenities Details
                        </span>
                        <span className="breakdown-total-badge">
                          {analysisResult.total} total
                        </span>
                      </div>
                      <div className="breakdown-grid">
                        {analysisResult.typeBreakdown.map((item) => (
                          <div key={item.id} className="breakdown-chip">
                            <span
                              className="breakdown-chip-dot"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="breakdown-chip-icon">
                              {item.icon}
                            </span>
                            <span className="breakdown-chip-label">
                              {item.label}
                            </span>
                            <span className="breakdown-chip-count">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {/* Top Action Bar */}
      <div
        className={["top-actions", isSidebarCollapsed ? "sidebar-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="quick-filters" aria-label="Place filters">
          {/* Quick Filter Pill: Restaurants */}
          <button
            type="button"
            className={
              isGroupActive("food") ? "filter-pill active" : "filter-pill"
            }
            onClick={() => handleQuickFilterClick("food")}
          >
            <span>🍽️</span>
            <span>Restaurants</span>
          </button>

          {/* Quick Filter Pill: Transport */}
          <button
            type="button"
            className={
              isGroupActive("transport") ? "filter-pill active" : "filter-pill"
            }
            onClick={() => handleQuickFilterClick("transport")}
          >
            <span>🚇</span>
            <span>Transport</span>
          </button>

          {/* Quick Filter Pill: Things to do */}
          <button
            type="button"
            className={
              isGroupActive("things-to-do")
                ? "filter-pill active"
                : "filter-pill"
            }
            onClick={() => handleQuickFilterClick("things-to-do")}
          >
            <span>🎯</span>
            <span>Things to do</span>
          </button>

          {/* Quick Filter Pill: Education */}
          <button
            type="button"
            className={
              isGroupActive("education") ? "filter-pill active" : "filter-pill"
            }
            onClick={() => handleQuickFilterClick("education")}
          >
            <span>🎓</span>
            <span>Education</span>
          </button>

          {/* THE 'ALL' BUTTON (Replaces old 'Shop' button) with Categorized Multi-Selection */}
          <div className="all-picker">
            <button
              id="all-toggle"
              // Keep alias shop-toggle for compatibility
              name="shop-toggle"
              type="button"
              className={[
                "filter-pill",
                "all-btn",
                allMenuOpen ? "active open" : "",
              ].join(" ")}
              onClick={() => setAllMenuOpen((prev) => !prev)}
              aria-expanded={allMenuOpen}
              aria-haspopup="true"
              aria-label="All categories with multi-selection"
            >
              <span>📂</span>
              <span>All</span>
              {selectedCategories.length > 0 ? (
                <span className="all-badge">{selectedCategories.length}</span>
              ) : null}
              <span className="chevron-arrow">▼</span>
            </button>

            {/* Categorized Multi-Selection Dropdown Popover */}
            {allMenuOpen ? (
              <div
                className="all-multi-menu"
                role="dialog"
                aria-label="All Categories Multi-selection"
              >
                {/* Menu Header with Search & Global Actions */}
                <div className="all-menu-header">
                  <div className="menu-header-top">
                    <div className="menu-title-wrap">
                      <span className="menu-title">All Categories</span>
                      <span className="selection-count-tag">
                        {selectedCategories.length} of{" "}
                        {ALL_CATEGORY_ITEMS.length} selected
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

                  {/* Search Input inside Dropdown */}
                  <div className="menu-search-wrap">
                    <span className="menu-search-icon">🔍</span>
                    <input
                      type="text"
                      className="menu-search-input"
                      placeholder="Filter categories (e.g. coffee, gym, groceries)..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Categorized Groups with Multi-Selection Checkboxes */}
                <div className="all-menu-body">
                  {filteredCategoryGroups.length === 0 ? (
                    <div className="menu-empty-state">
                      No categories match your search.
                    </div>
                  ) : (
                    filteredCategoryGroups.map((group) => {
                      const groupItemIds = group.items.map((i) => i.id);
                      const allGroupChecked = groupItemIds.every((id) =>
                        selectedCategories.includes(id),
                      );

                      return (
                        <div key={group.id} className="category-group-card">
                          <div className="category-group-header">
                            <div className="group-header-left">
                              <span>{group.icon}</span>
                              <span>{group.name}</span>
                              <span className="group-count-badge">
                                ({group.items.length})
                              </span>
                            </div>

                            <button
                              type="button"
                              className="group-toggle-btn"
                              onClick={() => toggleGroup(group.id)}
                            >
                              {allGroupChecked
                                ? "Deselect group"
                                : "Select all"}
                            </button>
                          </div>

                          <div className="category-items-grid">
                            {group.items.map((item) => {
                              const isChecked = selectedCategories.includes(
                                item.id,
                              );
                              return (
                                <label
                                  key={item.id}
                                  className={`category-checkbox-chip ${isChecked ? "checked" : ""}`}
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
                                  <span
                                    className="chip-label"
                                    title={item.label}
                                  >
                                    {item.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
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
            {mapMode === "2d" ? "2D View" : "3D View"}
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

          <div
            id="export-menu"
            className={exportMenuOpen ? "export-menu open" : "export-menu"}
          >
            <button type="button" onClick={() => handleExport("png")}>
              📸 PNG Map Image
            </button>
            <button type="button" onClick={() => handleExport("pdf")}>
              📄 PDF Map Report
            </button>
            <button type="button" onClick={() => handleExport("csv")}>
              📊 CSV Filtered Places
            </button>
          </div>
        </div>
      </div>

      {/* Map Overlay Badge */}
      <div className="overlay">
        <div className="badge">
          {mapMode === "2d" ? "PURE 2D MAP" : "3D PERSPECTIVE MAP"}
        </div>
        <h1>{selectedLocation.name}</h1>
        <p>
          {mapMode === "2d"
            ? "Pure 2D view, travel-time isochrones & categorized GIS"
            : "3D Buildings, terrain, and travel isochrones"}
        </p>
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
