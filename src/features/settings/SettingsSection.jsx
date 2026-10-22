import React, { useState, useEffect } from 'react';
import './styles.css';
import {
  getStoredFavorites,
  saveFavoriteLocation,
  removeFavoriteLocation,
  getStoredPreferences,
  savePreferences,
  PRICE_RANGE_OPTIONS,
  updateFavoriteBudget,
  filterFavoritesByBudget,
} from './settingsService.js';
import { searchPlace } from '../map/services/geocodingService.js';

export function SettingsSection({
  currentLocation,
  onSelectLocation,
  pinMode,
  onStartPinBookmark,
  onTogglePinBookmark,
  favoritesTrigger,
}) {
  const [favorites, setFavorites] = useState([]);
  const [budgetFilter, setBudgetFilter] = useState('all');
  const visibleFavorites = filterFavoritesByBudget(favorites, budgetFilter);
  const [preferences, setPreferences] = useState(getStoredPreferences());
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [inputError, setInputError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    setFavorites(getStoredFavorites());
    setPreferences(getStoredPreferences());
  }, [favoritesTrigger]);

  const handleAddBookmarkByAddress = async (query = bookmarkInput) => {
    const q = String(query || '').trim();
    if (!q) return;
    setIsSearching(true);
    setInputError('');
    try {
      const res = await searchPlace(q);
      if (res) {
        const newFav = {
          id: `fav-${Date.now()}`,
          name: res.shortName || res.name,
          address: res.address || q,
          coords: res.coords,
          type: 'Saved Bookmark',
          budgetTag: preferences.priceRange,
        };
        const updated = saveFavoriteLocation(newFav);
        setFavorites(updated);
        setBookmarkInput('');
        setSaveSuccessMsg(true);
        setTimeout(() => setSaveSuccessMsg(false), 2500);
      } else {
        setInputError(`Could not find coordinates for "${q}".`);
      }
    } catch (err) {
      console.warn('Geocoding bookmark error:', err);
      setInputError('Failed to geocode address.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveFavorite = (id) => {
    const updated = removeFavoriteLocation(id);
    setFavorites(updated);
  };

  const handlePriceSelect = (priceId) => {
    const updated = savePreferences({ priceRange: priceId });
    setPreferences(updated);
  };

  return (
    <div className="travel-studio settings-studio">
      {/* 1. Favorite Locations Section */}
      <div className="studio-section">
        <div className="section-label">
          <span>Saved Favorite Locations</span>
          {favorites.length > 0 && (
            <span className="section-count">{favorites.length} saved</span>
          )}
        </div>

        <label className="pref-sub-label">
          Budget tag for new bookmarks
          <select value={preferences.priceRange} onChange={event => handlePriceSelect(event.target.value)}>
            {PRICE_RANGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.id === 'all' ? 'No budget tag' : option.label}</option>)}
          </select>
        </label>
        <p className="favorite-item-addr">Your personal budget tag, not a verified venue price. Applies to searched and pinned bookmarks.</p>
        {/* Minimalist Pure Text Field matching Time Travel */}
        <div className="site-pure-inputs-container">
          <div className={`site-pure-input-row ${pinMode === 'bookmark' ? 'pin-active' : ''}`}>
            <input
              type="text"
              id="bookmark-address-input"
              className="site-pure-input-field"
              placeholder="Find a place or enter address"
              value={bookmarkInput}
              onChange={(e) => {
                setBookmarkInput(e.target.value);
                if (inputError) setInputError('');
              }}
              onClick={() => {
                if (onStartPinBookmark) onStartPinBookmark();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddBookmarkByAddress();
                }
              }}
            />
            <div className="site-pure-input-actions">
              {isSearching ? (
                <span className="site-searching-indicator">...</span>
              ) : null}
              {bookmarkInput ? (
                <button
                  type="button"
                  className="site-pure-icon-btn"
                  onClick={() => {
                    setBookmarkInput('');
                    setInputError('');
                  }}
                  title="Clear text"
                >
                  ✕
                </button>
              ) : null}
              <button
                type="button"
                className={`site-pure-icon-btn ${pinMode === 'bookmark' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTogglePinBookmark) onTogglePinBookmark();
                }}
                title={pinMode === 'bookmark' ? 'Cancel pinning' : 'Pin location on map'}
                aria-label="Pin on map"
              >
                {/* Folded Map Icon (Image 1 / Time Travel style) */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                </svg>
              </button>
              {bookmarkInput.trim() ? (
                <button
                  type="button"
                  className="site-pure-add-btn"
                  onClick={() => handleAddBookmarkByAddress()}
                  disabled={!bookmarkInput.trim() || isSearching}
                  title="Save address to bookmarks"
                >
                  + Add
                </button>
              ) : null}
            </div>
          </div>

          {inputError ? (
            <div className="site-pure-feedback error">{inputError}</div>
          ) : null}

          {saveSuccessMsg ? (
            <div className="site-pure-feedback success">✓ Saved to favorites</div>
          ) : null}
        </div>

        <label className="pref-sub-label">
          Show saved places
          <select value={budgetFilter} onChange={event => setBudgetFilter(event.target.value)}>
            {PRICE_RANGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.id === 'all' ? 'All saved places' : option.label}</option>)}
          </select>
        </label>
        {/* List of saved favorites */}
        <div className="favorites-list">
          {visibleFavorites.length === 0 ? (
            <div className="favorites-empty-card">
              No saved places match this filter.
            </div>
          ) : (
            visibleFavorites.map((fav) => (
              <div
                key={fav.id}
                className="favorite-item-card"
                onClick={() => onSelectLocation && onSelectLocation(fav)}
                title="Click to view this location on map"
              >
                <div className="favorite-item-left">
                  <div className="favorite-item-title-row">
                    <span className="favorite-pin-indicator">📍</span>
                    <span className="favorite-item-name">{fav.name}</span>
                  </div>
                  <span className="favorite-item-addr">{fav.address}</span>
                  <label className="favorite-item-addr" onClick={event => event.stopPropagation()}>
                    My budget tag
                    <select aria-label={`Budget tag for ${fav.name}`} value={fav.budgetTag || 'all'} onChange={event => {
                      try { setFavorites(updateFavoriteBudget(fav.id, event.target.value)); }
                      catch { setInputError('Could not save the budget tag. Check browser storage.'); }
                    }}>
                      {PRICE_RANGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.id === 'all' ? 'No budget tag' : option.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="favorite-item-actions">
                  <button
                    type="button"
                    className="site-pure-icon-btn site-pure-trash-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(fav.id);
                    }}
                    title="Remove from favorites"
                    aria-label="Remove from favorites"
                  >
                    {/* Trash Can Icon (Image 1 / Time Travel style) */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
