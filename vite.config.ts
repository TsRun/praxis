/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Railpack mounts node_modules as a BuildKit cache volume, which makes the
  // default node_modules/.vite cache un-removable during `npm ci`. Park it
  // outside node_modules instead.
  cacheDir: '.vite-cache',
  server: {
    proxy: {
      '/api/openings': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openings/, '/lichess-org/chess-openings/master'),
      },
      // Everything else under /api goes to the local Fastify backend.
      '/api': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', 'tests/e2e/**'],
  },
});
