// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  exposes: {
    './widget/TemplateSelector': './src/widgets/TemplateSelector.tsx',
    './api/fetchDocuments': './src/api/documents.ts',
    './api/saveDocument': './src/api/save-document.ts',
    './contract/ComplianceDocument': './src/contracts/documents.ts'
  },
});