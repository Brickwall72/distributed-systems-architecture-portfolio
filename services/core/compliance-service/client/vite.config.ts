// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  exposes: {
    './TemplateSelector':  './src/widgets/TemplateSelector',
    './widget/DocumentsTable':    './src/widgets/DocumentsTable/DocumentsTable.tsx',
    './ComplianceWorkflowWidget': './src/widgets/ComplianceWorkflow'
  },
});