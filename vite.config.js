import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiBackendPlugin } from './server.js';

export default defineConfig({
  plugins: [react(), aiBackendPlugin()],
  envPrefix: 'VITE_',
});

