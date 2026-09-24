// File: ui-shells/domain-shells/topology-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'topology',
  concern: 'shell',
  exposes: {
    './App': './src/App.tsx',
  },
  remotes: {
    topology_client: {
        type: 'module',
        name: 'topology-client',
        entry: `${process.env.VITE_ORIGIN}/topology/client/remoteEntry.js`
    },
  },
  preview: {
    port: 3010,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});