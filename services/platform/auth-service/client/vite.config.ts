// File: services/platform/auth-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'auth',
  concern: 'client',
  exposes: {
    './ProfileSelector':    './src/widgets/ProfileSelector',
  },
});