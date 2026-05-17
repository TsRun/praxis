/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/chessdb': {
        target: 'https://www.chessdb.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chessdb/, '/cdb.php'),
      },
      '/api/openings': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openings/, '/lichess-org/chess-openings/master'),
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
