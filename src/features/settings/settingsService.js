/**
 * Settings Service (Feature-based Architecture)
 * Manages user preferences (price range, default travel mode/time)
 * and saved favorite locations in localStorage.
 */

const STORAGE_KEY_FAVORITES = 'sime_darby_gis_favorites_v1';
const STORAGE_KEY_PREFERENCES = 'sime_darby_gis_preferences_v1';

export const DEFAULT_FAVORITE_LOCATIONS = [];

export const PRICE_RANGE_OPTIONS = [
  { id: 'all', label: 'All Prices', symbol: 'Any' },
  { id: '1', label: 'Budget', symbol: '$' },
  { id: '2', label: 'Moderate', symbol: '$$' },
  { id: '3', label: 'Upscale', symbol: '$$$' },
  { id: '4', label: 'Luxury', symbol: '$$$$' },
];

export const DEFAULT_PREFERENCES = {
  priceRange: 'all',
  defaultTravelMode: 'walking',
  defaultMinutes: 20,
  autoExpandAddress: false,
  prioritizeTransit: true,
};

export function getStoredFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (f) =>
          !f.isPreset &&
          f.id !== 'fav-sime-darby' &&
          f.id !== 'fav-pavilion-kl' &&
          f.id !== 'fav-subang-jaya'
      );
    }
    return [];
  } catch (err) {
    console.warn('Could not read favorites from storage:', err);
    return [];
  }
}

export function saveFavoriteLocation(location) {
  if (!location || !location.name) return getStoredFavorites();
  const current = getStoredFavorites();
  const exists = current.some((f) => f.id === location.id || (f.name === location.name && f.address === location.address));
  if (exists) return current;

  const newFav = {
    id: location.id || `fav-${Date.now()}`,
    name: location.name,
    address: location.address || 'Kuala Lumpur, Malaysia',
    coords: location.coords || [101.7069, 3.1390],
    type: location.type || 'Saved Favorite',
    budgetTag: location.budgetTag ?? getStoredPreferences().priceRange,
    savedAt: new Date().toISOString(),
  };

  const updated = [newFav, ...current];
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not persist favorites to storage:', err);
  }
  return updated;
}

export function removeFavoriteLocation(id) {
  const current = getStoredFavorites();
  const updated = current.filter((f) => f.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not update favorites in storage:', err);
  }
  return updated;
}

export function getStoredPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (err) {
    console.warn('Could not read preferences from storage:', err);
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(newPrefs) {
  try {
    const current = getStoredPreferences();
    const updated = { ...current, ...newPrefs };
    localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Could not persist preferences to storage:', err);
    return DEFAULT_PREFERENCES;
  }
}

export function updateFavoriteBudget(id, budgetTag) {
  if (!PRICE_RANGE_OPTIONS.some(option => option.id === budgetTag)) return getStoredFavorites();
  const updated = getStoredFavorites().map(place => place.id === id ? { ...place, budgetTag } : place);
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
  return updated;
}

export function filterFavoritesByBudget(favorites, budgetTag) {
  return budgetTag === 'all' ? favorites : favorites.filter(place => place.budgetTag === budgetTag);
}
