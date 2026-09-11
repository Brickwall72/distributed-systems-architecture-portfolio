// File: services/core/esign-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'esign',
  concern: 'client',
  port: Number.parseInt(process.env.CLIENT_PORT || '4012'),
  exposes: {
    './SignatureOverlay': './src/widgets/SignatureOverlay.tsx',
  }
});