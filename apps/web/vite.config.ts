import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const runtimeMode = env.VITE_RUNTIME_MODE ?? 'demo';
  return {
    define: {
      __RUNTIME_MODE__: JSON.stringify(runtimeMode),
    },
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
  };
});
