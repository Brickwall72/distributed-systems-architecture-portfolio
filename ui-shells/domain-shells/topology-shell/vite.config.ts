// File: ui-shells/domain-shells/topology-shell/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
	server: {
    port: Number.parseInt(process.env.PORT || '3010'), // Unique port for the compliance domain shell
    host: true,
    cors: true,
    proxy: {
      '/api/v1/topology': {
        target: process.env.VITE_TOPOLOGY_API_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    federation({
      name: 'topology_shell',
      filename: 'remoteEntry.js',
      remotes: {
        topology_service: {
            type: 'module',
            name: 'topology-service',
            entry: `${process.env.VITE_REMOTE_ENTRY || 'http://localhost:3011/remoteEntry.js'}`,
        },
      },
      exposes: {
        './App': './src/App.tsx',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  preview: {
    port: 3010,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
  build: {
    target: 'esnext',
  },
});