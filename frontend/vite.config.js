import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        // Don't cache dead connections — reconnect on each request
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.warn('[proxy error]', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Backend unavailable', code: 502 }));
          });
        },
      },
    },
  },
});
