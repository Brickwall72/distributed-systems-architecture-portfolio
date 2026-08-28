// File: services/core/topology-service/client/vite.config.ts
// CORRECTED: Import defineConfig directly from vitest/config to safely expose the 'test' schema layout properties
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api/v1': {
        // nosonar: Internal private Docker bridge communication
        target: 'http://topology-server:8081', 
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
});
