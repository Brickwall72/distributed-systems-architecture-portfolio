// File: services/core/compliance-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'compliance_service',
  port: Number.parseInt(process.env.CLIENT_PORT || '3021'),
  exposes: {
    './Widget': './src/ComplianceWidget.tsx',
  },
});