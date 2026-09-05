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
      target: process.env.VITE_PDF_API_URL || 'http://localhost:4001',
      changeOrigin: true,
      secure: false,
    },
  },
  remotes: {
    pdf_client: {
        type: 'module',
        name: 'pdf-client',
        entry: `${process.env.VITE_REMOTE_ENTRY || 'http://localhost:4011/remoteEntry.js'}`,
    },
  },
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
});