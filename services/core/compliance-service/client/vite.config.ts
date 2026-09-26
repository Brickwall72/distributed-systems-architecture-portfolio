// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  exposes: {
    './widget/TemplateSelector': './src/widgets/TemplateSelector.tsx',
    './api': './src/api/index.ts',
    './contract/ComplianceDocument': './src/contracts/documents.ts'
  },
});