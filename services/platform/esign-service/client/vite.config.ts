// File: services/core/esign-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'esign',
  concern: 'client',
  exposes: {
    './widget/SignatureOverlay': './src/widgets/SignatureOverlay.tsx',
  }
});