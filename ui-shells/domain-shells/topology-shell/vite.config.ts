// File: ui-shells/domain-shells/topology-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'topology_shell',
  port: Number.parseInt(process.env.PORT || '3010'),
  exposes: {
    './App': './src/App.tsx',
  },
  proxy: {
    '/api/v1/topology': {
      target: process.env.VITE_TOPOLOGY_API_URL || 'http://localhost:8081',
      changeOrigin: true,
      secure: false,
    },
  },
  remotes: {
    topology_service: {
        type: 'module',
        name: 'topology-service',
        entry: `${process.env.VITE_REMOTE_ENTRY || 'http://localhost:3011/remoteEntry.js'}`,
    },
  },
  preview: {
    port: 3010,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});