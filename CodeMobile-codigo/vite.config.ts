import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { monacoCompat } from './scripts/monaco-compat.mjs';

// Os workers rodam em outro realm: nada do index.html chega até eles. Este
// mesmo arquivo (public/compat.js) é usado como banner dos bundles de worker.
const compatSource = readFileSync(new URL('./public/compat.js', import.meta.url), 'utf8');

// Extra dev-server hostnames (comma separated), supplied by the environment.
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  // Relative base keeps the build working from file://, http://localhost and any subpath.
  base: './',
  plugins: [monacoCompat(), react()],
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
    // es2020 é o mínimo possível aqui: o worker do Luau usa literais BigInt.
    // O `?.`/`??` restante é rebaixado depois por scripts/downlevel.mjs.
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
  },
  worker: {
    // Worker clássico (IIFE): o WebView do Android 9 não cria module workers.
    format: 'iife',
    // O build de worker não herda os plugins do bundle principal: sem isso o
    // regex com flag `d` do Monaco volta a derrubar editor.worker/html.worker.
    plugins: [monacoCompat()],
    rollupOptions: {
      output: { banner: compatSource },
    },
  },
});
