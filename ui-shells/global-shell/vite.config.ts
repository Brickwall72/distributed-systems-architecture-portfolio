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
  port: Number.parseInt(process.env.PORT || '3000'),
  proxy: {
    '/api/v1/topology': {
      target: process.env.TOPOLOGY_API_URL || 'http://localhost:8083',
      changeOrigin: true,
      secure: false,
    },
    '/api/v1/pdf': {
    target: process.env.PDF_API_URL || 'http://localhost:4001',
    changeOrigin: true,
    secure: false,
    },
    '/api/v1/esign': {
    target: process.env.ESIGN_API_URL || 'http://localhost:4002',
    changeOrigin: true,
    secure: false,
    },
    '/api/v1/compliance': {
    target: process.env.COMPLIANCE_API_URL || 'http://localhost:8082',
    changeOrigin: true,
    secure: false,
    },
  },
  remotes: {
    topology_shell: {
      type: 'module',
      name: 'topology_shell',
      entry: `${process.env.TOPOLOGY_REMOTE_ENTRY || 'http://localhost:8081/topology/remoteEntry.js'}`
    },
    compliance_shell: {
      type: 'module',
      name: 'compliance_shell',
      entry: `${process.env.COMPLIANCE_REMOTE_ENTRY || 'http://localhost:8081/compliance/remoteEntry.js'}`
    }
  },
});