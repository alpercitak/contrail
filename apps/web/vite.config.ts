import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: true,
        advancedChunks: {
          groups: [
            { name: 'maplibre-gl', test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/ },
            { name: 'feed-mock', test: /[\\/]packages[\\/]feed-mock[\\/]/ },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: -10 },
          ],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
