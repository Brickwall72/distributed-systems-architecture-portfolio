// File: ui-shells/global-shell/vite.config.ts

/**
 * Vite configuration for the host shell.
 *
 * This shell serves the federated UI and proxies the topology API to the local
 * service runtime so the remote module can resolve the live data contract.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import mfConfig from './module-federation.config.ts';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    origin: 'http://localhost:3000',
    proxy: {
      '/api/v1/topology': {
        target: process.env.VITE_TOPOLOGY_API_URL || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/pdf': {
      target: process.env.VITE_PDF_API_URL || 'http://localhost:4001',
      changeOrigin: true,
      secure: false,
      },
    },
  },
  base: 'http://localhost',
  plugins: [react(), federation(mfConfig)],
  build: { target: 'chrome89' },
});
