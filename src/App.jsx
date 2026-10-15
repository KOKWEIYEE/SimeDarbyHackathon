import { useEffect, useRef, useState } from 'react';
import './features/ai/styles.css';
import { initMapFeature } from './features/map/index.js';

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
  const aiPanelRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapErrorRef = useRef(null);
  const mapFeatureRef = useRef(null);

  const [panelMode, setPanelMode] = useState('b');
  const [isFullSize, setIsFullSize] = useState(false);
  const [mapMode, setMapMode] = useState('2d');
  const [errorMessage, setErrorMessage] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Welcome to Abso — your AI GIS analyst. Ask about the map, location insights, or export options.',
    },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const apiKey = (import.meta.env.VITE_MAPBOX_API_KEY ?? '').trim();

    if (!apiKey) {
      setErrorMessage('Missing VITE_MAPBOX_API_KEY in your .env file.');
      return undefined;
    }

    const feature = initMapFeature({
      apiKey,
      mapContainerRef,
      errorBoxRef: mapErrorRef,
      onModeChange: setMapMode,
    });

    mapFeatureRef.current = feature;

    return () => {
      feature.map.remove();
    };
  }, []);

  useEffect(() => {
    const panel = aiPanelRef.current;
    if (!panel) return;

    panel.classList.toggle('minimized', panelMode === 'a');
    panel.classList.toggle('left-panel', panelMode === 'b');
    panel.classList.toggle('expanded', isFullSize);
    appRef.current?.classList.toggle('chat-only', isFullSize);
  }, [panelMode, isFullSize]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!target.closest('.export-menu') && !target.closest('#export-toggle')) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleMapMode = () => {
    if (!mapFeatureRef.current) return;
    const nextMode = mapMode === '2d' ? '3d' : '2d';
    mapFeatureRef.current.applyMapView(nextMode);
    setMapMode(nextMode);
  };

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
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const canvas = await window.html2canvas(document.getElementById('map'));
      const imageData = canvas.toDataURL('image/png');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imageData, 'PNG', 20, 20, pageWidth - 40, pageHeight - 40);
      pdf.save('sime-darby-map.pdf');
      return;
    }

    if (type === 'csv') {
      const csv = [
        'title,center_lng,center_lat,pitch,bearing',
        'Sime Darby,101.7069,3.139,63,-15',
      ].join('\n');

      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        'sime-darby-map.csv',
      );
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSend = () => {
    const nextMessage = draft.trim();
    if (!nextMessage) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: nextMessage,
    };

    const botReply = {
      id: Date.now() + 1,
      sender: 'bot',
      text: 'I can help with that. Try refining the map view, checking nearby context, or exporting the current scene.',
    };

    setMessages((previousMessages) => [...previousMessages, userMessage, botReply]);
    setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div id="app" ref={appRef} className={isFullSize ? 'chat-only' : ''}>
      <div id="map" ref={mapContainerRef} />

      <aside
        ref={aiPanelRef}
        className={[
          'ai-panel',
          isFullSize ? 'expanded' : '',
          panelMode === 'a' ? 'minimized' : '',
          panelMode === 'b' ? 'left-panel' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="panel-header">
          <div className="panel-title-wrap">
            <div className="panel-icon">a</div>
            <span className="project-title">Your first project</span>
          </div>

          <div className="panel-actions">
            <button
              id="compact-size-toggle"
              className="icon-btn"
              type="button"
              aria-label={panelMode === 'a' ? 'Expand chat panel' : 'Minimize chat panel'}
              onClick={() => {
                if (!isFullSize) {
                  setPanelMode((previousMode) => (previousMode === 'b' ? 'a' : 'b'));
                }
              }}
            >
              {panelMode === 'a' ? '↓' : '↑'}
            </button>

            <button
              id="full-size-toggle"
              className="icon-btn"
              type="button"
              aria-label={isFullSize ? 'Return to compact chat panel' : 'Toggle full size chat panel'}
              onClick={() => setIsFullSize((previousState) => !previousState)}
            >
              {isFullSize ? '⤡' : '⤢'}
            </button>
          </div>
        </div>

        <div className="panel-body">
          <div className="panel-scroll">
            <div className="welcome-card">
              <div className="welcome-icon">⚡</div>
              <h2>Welcome to Abso — your AI GIS analyst</h2>
              <p>Upload your datasets, select a location, or start with an AI query.</p>
            </div>

            <div className="message-list">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.sender}`}>
                  {message.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="tips-card">
              <div className="tips-icon">📖</div>
              <div className="tips-copy">
                <p>Please check the info below before you start</p>
                <h3>How to run prompts for best results</h3>
                <button className="link-btn" type="button">Explore AI Glossary ↗</button>
                <button className="link-btn" type="button">What data you can use ↗</button>
              </div>
            </div>
          </div>

          <div className="chat-input-shell">
            <textarea
              id="ai-input"
              rows="1"
              placeholder="Type a message..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button id="send-btn" className="send-btn" type="button" onClick={handleSend}>
              →
            </button>
          </div>
        </div>
      </aside>

      <div className="top-actions">
        <div className="view-toggle-wrap">
          <button
            id="view-toggle"
            className="view-toggle"
            type="button"
            aria-label="Toggle map view"
            onClick={toggleMapMode}
          >
            {mapMode === '2d' ? '2D' : '3D'}
          </button>
        </div>

        <div className="export-wrap">
          <button
            id="export-toggle"
            className="export-btn"
            type="button"
            onClick={() => setExportMenuOpen((previousState) => !previousState)}
          >
            Export
          </button>

          <div id="export-menu" className={exportMenuOpen ? 'export-menu open' : 'export-menu'}>
            <button type="button" onClick={() => handleExport('png')}>PNG</button>
            <button type="button" onClick={() => handleExport('pdf')}>PDF</button>
            <button type="button" onClick={() => handleExport('csv')}>CSV</button>
          </div>
        </div>
      </div>

      <div className="overlay">
        <div className="badge">LIVE MAP</div>
        <h1>Sime Darby</h1>
        <p>3D terrain and city context background</p>
      </div>

      {errorMessage ? (
        <div ref={mapErrorRef} className="map-error">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
