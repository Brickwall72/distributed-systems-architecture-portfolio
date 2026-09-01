// File: services/core/compliance-service/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'compliance_service', // Must match the remote scope name the shell imports from
      filename: 'remoteEntry.js',
      exposes: {
        './Widget': './src/ComplianceWidget.tsx', // Exposes the widget publicly
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  server: {
    port: Number.parseInt(process.env.CLIENT_PORT || '3021'),
		host: '0.0.0.0',
    strictPort: true,
    cors: true,
		origin: `http://localhost:${process.env.CLIENT_PORT || '3021'}`,
  },
  build: {
    target: 'esnext',
  },
});