// File: ui-shells/domain-shells/compliance-shell/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
	server: {
    port: Number.parseInt(process.env.PORT || '3020'), // Unique port for the compliance domain shell
    host: true,
    cors: true,
  },
  plugins: [
    react(),
    federation({
      name: 'compliance_shell',
      filename: 'remoteEntry.js',
      remotes: {
        compliance_service: {
            type: 'module',
            name: 'compliance-service',
            entry: `${process.env.VITE_REMOTE_ENTRY || 'http://localhost:3021/remoteEntry.js'}`,
        },
      },
      exposes: {
        './App': './src/App.tsx',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  preview: {
    port: 3020,
    host: true, // Also add this if your Dockerfile uses 'vite preview' for production builds
  },
  build: {
    target: 'esnext',
  },
});