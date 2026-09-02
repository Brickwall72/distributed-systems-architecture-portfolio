// File: ui-shells/domain-shells/compliance-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'compliance_shell',
  port: Number.parseInt(process.env.PORT || '3020'),
  exposes: {
    './App': './src/App.tsx',
  },
  remotes: {
    compliance_service: {
        type: 'module',
        name: 'compliance-service',
        entry: `${process.env.VITE_REMOTE_ENTRY || 'http://localhost:3021/remoteEntry.js'}`,
    },
  },
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});