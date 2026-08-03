/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxying /api in development means the browser sees one origin, so no
    // CORS preflight locally. Production uses the real cross-origin setup
    // (Vercel -> Railway), which the API allows explicitly via CORS_ORIGIN.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // `/health` is deliberately unversioned so platform probes hit a stable
      // path, which means it sits outside `/api` and needs its own proxy rule.
      // Without this the dev server answers with index.html and the client
      // fails parsing HTML as JSON.
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  /**
   * Vitest rather than Jest, and not for novelty: it reads this same config,
   * so the tests resolve modules exactly as the application does. A separate
   * Jest transform pipeline would be a second definition of "how this project
   * builds" — the kind that passes while the real build fails.
   *
   * The API keeps Jest, which is what @nestjs/testing expects. Two runners is
   * the honest answer when two runtimes have different needs.
   */
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
