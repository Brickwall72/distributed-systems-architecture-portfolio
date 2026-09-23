// File: ui-shells/domain-shells/compliance-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'shell',
  exposes: {
    './App': './src/App.tsx',
  },
  remotes: {
    pdf_client: {
      type: 'module',
      name: 'pdf-client',
      entry: `${process.env.VITE_ORIGIN}/pdf/client/remoteEntry.js`,
    },
    topology_client: {
      type: 'module',
      name: 'topology-client',
      entry:`${process.env.VITE_ORIGIN}/topology/client/remoteEntry.js`,
    },
    compliance_client: {
      type: 'module',
      name: 'compliance-client',
      entry: `${process.env.VITE_ORIGIN}/compliance/client/remoteEntry.js`,
    },
    esign_client: {
      type: 'module',
      name: 'esign-client',
      entry: `${process.env.VITE_ORIGIN}/esign/client/remoteEntry.js`,
    },
  },
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});