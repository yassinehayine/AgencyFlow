import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxying /api in development means the browser sees one origin, so no
    // CORS preflight locally. Production uses the real cross-origin setup
    // (Vercel -> Render), which the API allows explicitly via CORS_ORIGIN.
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
});
