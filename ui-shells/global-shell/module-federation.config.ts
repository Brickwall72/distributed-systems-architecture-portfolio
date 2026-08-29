// File: ui-shells/global-shell/module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/vite';

/*
 * Host shell configuration for dynamically loading the topology remote.
 * The remote is consumed by name and points back to the topology client entry
 * exposed by the service on port 3002.
 */
export default createModuleFederationConfig({
  name: 'ui_shell',
  manifest: true,
  dts: true,
  remotes: {
    topology_service: {
      type: 'module',
      name: 'topology_service',
      // Use the concrete local host binding expected by the remote service.
      entry: 'http://localhost:3002/remoteEntry.js',
    },
  },
  shared: {
    react: { singleton: true, requiredVersion: '~19.2.8' },
    'react-dom': { singleton: true, requiredVersion: '~19.2.8' },
  },
});