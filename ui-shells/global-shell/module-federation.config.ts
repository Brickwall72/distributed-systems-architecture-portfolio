// File: ui-shells/global-shell/module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/vite';

const topologyEntryUrl = process.env.VITE_TOPOLOGY_REMOTE_ENTRY ?? 'http://localhost:3010/remoteEntry.js';
const complianceEntryUrl = process.env.VITE_COMPLIANCE_REMOTE_ENTRY ?? 'http://localhost:3020/remoteEntry.js';

export default createModuleFederationConfig({
  name: 'ui_shell',
  manifest: true,
  dts: true,
  remotes: {
    topology_shell: {
      type: 'module',
      name: 'topology_shell',
      entry: topologyEntryUrl,
    },
    compliance_shell: {
      type: 'module',
      name: 'compliance_shell',
      entry: complianceEntryUrl,
    },
  },
  shared: {
    react: { singleton: true, requiredVersion: '~19.2.8' },
    'react-dom': { singleton: true, requiredVersion: '~19.2.8' },
  },
});