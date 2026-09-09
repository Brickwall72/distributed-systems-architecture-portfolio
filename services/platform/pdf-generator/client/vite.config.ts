// File: services/core/pdf-generator/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'pdf',
  concern: 'client',
  port: Number.parseInt(process.env.CLIENT_PORT || '4011'),
  exposes: {
    './GeneratePdfButton': './src/widgets/GeneratePdfButton.tsx',
  }
});