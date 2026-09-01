// File: ui-shells/global-shell/module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/vite';

const remoteEntryUrl = process.env.VITE_REMOTE_ENTRY ?? 'http://localhost:3010/remoteEntry.js';

/*
 * Host shell configuration for dynamically loading the topology remote.
 * The remote is consumed by name and points to the browser-resolvable host for
 * the topology client. The actual proxy target remains environment-specific.
 */
export default createModuleFederationConfig({
  name: 'ui_shell',
  manifest: true,
  dts: true,
  remotes: {
    topology_service: {
      type: 'module',
      name: 'topology_service',
      entry: remoteEntryUrl,
    },
  },
  shared: {
    react: { singleton: true, requiredVersion: '~19.2.8' },
    'react-dom': { singleton: true, requiredVersion: '~19.2.8' },
  },
});