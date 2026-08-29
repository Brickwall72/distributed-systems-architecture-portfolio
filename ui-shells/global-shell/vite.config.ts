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
    host: 'localhost', // Keep the dev server bound to the local IPv4 loopback.
    origin: 'http://localhost:3000',
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8081', // Local topology service port exposed by Docker.
        changeOrigin: true,
        secure: false,
      },
    },
  },
  base: 'http://localhost',
  plugins: [react(), federation(mfConfig)],
  build: { target: 'chrome89' },
});
