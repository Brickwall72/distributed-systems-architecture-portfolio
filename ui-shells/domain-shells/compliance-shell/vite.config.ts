// File: ui-shells/domain-shells/compliance-shell/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'compliance_shell',
  port: Number.parseInt(process.env.PORT || '3020'),
  exposes: {
    './App': './src/App.tsx',
  },
  proxy: {
    '/api/v1/pdf': {
      target: process.env.PDF_API_URL || 'http://localhost:4001',
      changeOrigin: true,
      secure: false,
    },
    '/api/v1/topology': {
      target: process.env.TOPOLOGY_API_URL || 'http://localhost:8081',
      changeOrigin: true,
      secure: false,
    }
  },
  remotes: {
    pdf_client: {
      type: 'module',
      name: 'pdf-client',
      entry: `${process.env.PDF_REMOTE_ENTRY || 'http://localhost:4011/remoteEntry.js'}`,
    },
    topology_client: {
      type: 'module',
      name: 'topology-client',
      entry: `${process.env.TOPOLOGY_REMOTE_ENTRY || 'http://localhost:3011/remoteEntry.js'}`
    },
    compliance_client: {
      type: 'module',
      name: 'compliance-client',
      entry: `${process.env.COMPLIANCE_REMOTE_ENTRY || 'http://localhost:3021/remoteEntry.js'}`
    }
  },
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});