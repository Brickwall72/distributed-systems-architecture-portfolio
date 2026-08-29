// File: services/core/topology-service/client/vite.config.ts

/**
 * Development-time Vite configuration for the topology client.
 *
 * It exposes the service on a predictable client port and proxies topology
 * requests through the local topology server during local development.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientPort = process.env.CLIENT_PORT ? Number.parseInt(process.env.CLIENT_PORT, 10) : 3002;
const serverPort = process.env.SERVER_PORT ? Number.parseInt(process.env.SERVER_PORT, 10) : 8081;

export default defineConfig({
  server: {
    port: clientPort,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api/v1': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
});
