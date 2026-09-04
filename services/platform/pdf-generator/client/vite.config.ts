// File: services/core/pdf-generator/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'pdf_generator',
  port: Number.parseInt(process.env.CLIENT_PORT || '4011'),
  exposes: {
    './GeneratePdfButton': './src/widgets/GeneratePdfButton.tsx',
  }
});