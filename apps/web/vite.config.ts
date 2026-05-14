import { defineConfig } from 'vite';
import webfontDownload from 'vite-plugin-webfont-dl';

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500&display=swap';

export default defineConfig({
  plugins: [webfontDownload([FONT_URL], { assetsSubfolder: 'fonts', subsetsAllowed: ['latin'] })],
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
        codeSplitting: {
          groups: [
            { name: 'maplibre-gl', test: /maplibre-gl/, priority: 10 },
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
