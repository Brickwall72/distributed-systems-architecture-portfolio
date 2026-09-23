// File: services/core/esign-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'esign',
  concern: 'client',
  exposes: {
    './SignatureOverlay': './src/widgets/SignatureOverlay.tsx',
  }
});