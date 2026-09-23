// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  exposes: {
    './TemplateSelector': './src/widgets/TemplateSelector.tsx',
    './api': './src/api/index.ts',
    './contracts': './src/contracts/index.ts'
  },
});