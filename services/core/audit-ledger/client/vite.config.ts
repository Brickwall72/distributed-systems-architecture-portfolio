// File: services/core/audit-ledger/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'audit',
  concern: 'client',
  exposes: {
  },
});