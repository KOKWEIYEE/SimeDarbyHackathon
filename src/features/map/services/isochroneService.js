export const MAPBOX_ISOCHRONE_URL = 'https://api.mapbox.com/isochrone/v1/mapbox';
export const MINUTES = [10, 20, 30];
export const CONTOUR_STYLE = { 10: '#22c55e', 20: '#eab308', 30: '#f97316' };
export const ISOCHRONE_COLORS = CONTOUR_STYLE;
export const MODE_LABEL = { walking: 'walk', cycling: 'bike', driving: 'drive' };

export async function fetchIsochrones(profile = 'walking', lng, lat, token, minutes = [10, 20, 30]) {
  if (!token) throw new Error('Missing Mapbox token for Isochrone request');
  const minutesParam = Array.isArray(minutes) ? minutes.join(',') : String(minutes);
  const url = `${MAPBOX_ISOCHRONE_URL}/${profile}/${lng},${lat}?contours_minutes=${minutesParam}&polygons=true&denoise=1&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Mapbox error ${res.status}`);

  return (data.features || []).sort(
    (a, b) => (a.properties?.contour ?? 0) - (b.properties?.contour ?? 0)
  );
}
