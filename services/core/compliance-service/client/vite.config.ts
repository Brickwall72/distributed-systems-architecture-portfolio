// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  port: Number.parseInt(process.env.CLIENT_PORT || '3021'),
  exposes: {
    './TemplateSelector': './src/widgets/TemplateSelector.tsx',
    './api': './src/api/index.ts'
  },
});