// File: services/core/topology-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'topology',
  concern: 'client',
  exposes: {
    './widget/ConnectionForm': './src/widgets/ConnectionFormWidget.tsx',
    './widget/NetworkCanvas': './src/widgets/NetworkCanvasWidget.tsx',
    './widget/AssetSelector': './src/widgets/AssetSelector.tsx',
    './widget/OrganizationSelector': './src/widgets/OrganizationSelector.tsx',
  }
});