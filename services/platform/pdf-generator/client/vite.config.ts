// File: services/core/pdf-generator/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'pdf',
  concern: 'client',
  exposes: {
    './widget/GeneratePdfButton': './src/widgets/GeneratePdfButton.tsx',
  }
});