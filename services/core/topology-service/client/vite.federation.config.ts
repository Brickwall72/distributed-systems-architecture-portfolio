// File: services/core/topology-service/client/vite.federation.config.ts

/**
 * Federation build configuration for the topology remote application.
 *
 * This config is used when packaging the service as a standalone remote so the
 * shell can consume it over a module-federated bridge.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const clientPort = process.env.CLIENT_PORT ? Number.parseInt(process.env.CLIENT_PORT, 10) : 3002;

export default defineConfig({
  server: {
    port: clientPort,
    host: '0.0.0.0',
    strictPort: true,
    cors: true,
    origin: `http://localhost:${clientPort}`,
  },
  base: `http://localhost:${clientPort}/`,
  plugins: [
    react(),
    federation({
      name: 'topology_service',
      filename: 'remoteEntry.js',
      manifest: true,
      dts: true,
      exposes: {
        './App': './src/App.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '~19.2.8' },
        'react-dom': { singleton: true, requiredVersion: '~19.2.8' },
      },
    }),
  ],
  build: { target: 'chrome89' },
});
