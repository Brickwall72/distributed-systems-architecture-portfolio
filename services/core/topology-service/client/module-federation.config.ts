// File: services/core/topology-service/client/module-federation.config.ts

/*
 * Remote module configuration for the topology microfrontend.
 * This exposes the App entry point so the global shell can consume it via
 * module federation at runtime.
 */
export default {
  name: 'topology_service',
  filename: 'remoteEntry.js',
  manifest: true,
  dts: true,
  exposes: {
    './App': './src/App.tsx',
  },
  shared: {
    react: {
      singleton: true,
      requiredVersion: '~19.2.8',
      eager: true, // Crucial for standalone localhost:3002 loading
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '~19.2.8',
      eager: true,
    },
    'react/jsx-runtime': {
      singleton: true,
      requiredVersion: '~19.2.8',
      eager: true,
    },
  },
};
