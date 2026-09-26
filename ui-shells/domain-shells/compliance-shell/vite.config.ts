// File: ui-shells/domain-shells/compliance-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'shell',
  exposes: {
    './App': './src/App.tsx',
  },
  remotes: {},
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});