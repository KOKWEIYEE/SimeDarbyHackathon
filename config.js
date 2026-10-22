const DEFAULT_PUBLIC_TOKEN = [
  'pk',
  'eyJ1IjoicmVkYmVhbjM2IiwiYSI6ImNtdjd3Z2o4ODA5a2QyeXB4NmZreXU1ZTkifQ',
  'XDnCbH8GrBQAklP-onqqpw',
].join('.');

export const mapboxConfig = {
  token: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPBOX_API_KEY) || DEFAULT_PUBLIC_TOKEN,
};

export const MAPBOX_API_KEY = mapboxConfig.token;
