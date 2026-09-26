// File: ui-shells/global-shell/vite.config.ts

/**
 * Vite configuration for the host shell.
 *
 * This shell serves the federated UI and proxies the topology API to the local
 * service runtime so the remote module can resolve the live data contract.
 */
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'global',
  concern: 'shell',
  remotes: {},
});