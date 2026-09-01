// File: services/core/topology-service/client/vite.federation.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const clientPort = Number.parseInt(process.env.CLIENT_PORT || '3011');

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'topology_service', // Must match the remote scope name the shell imports from
      filename: 'remoteEntry.js',
      exposes: {
        './Widget': './src/TopologyCanvas.tsx', // Exposes the widget publicly
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '~19.2.8',
          eager: false, // Crucial for standalone localhost:3002 loading
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '~19.2.8',
          eager: false,
        },
        'react/jsx-runtime': {
          singleton: true,
          requiredVersion: '~19.2.8',
          eager: false,
        },
      },
    }),
  ],
  server: {
    port: clientPort,
		host: '0.0.0.0',
    strictPort: true,
    cors: true,
		origin: `http://localhost:${clientPort}`,
  },
  build: {
    target: 'esnext',
  },
});