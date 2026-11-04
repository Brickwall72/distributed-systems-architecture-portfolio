// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'compliance',
  concern: 'client',
  exposes: {
    './DocumentsTable':    './src/widgets/DocumentsTable',
    './ComplianceWorkflowWidget': './src/widgets/ComplianceWorkflow',
    './TemplateSelector': './src/widgets/TemplateSelector',
  },
});