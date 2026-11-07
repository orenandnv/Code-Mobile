import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Extra dev-server hostnames (comma separated), supplied by the environment.
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  // Relative base keeps the build working from file://, http://localhost and any subpath.
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    ...(allowedHosts.length ? { allowedHosts } : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    ...(allowedHosts.length ? { allowedHosts } : {}),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
  },
});
