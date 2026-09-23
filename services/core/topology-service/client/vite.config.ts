// File: services/core/topology-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'topology',
  concern: 'client',
  exposes: {
    './ConnectionFormWidget': './src/widgets/ConnectionFormWidget.tsx',
    './NetworkCanvasWidget': './src/widgets/NetworkCanvasWidget.tsx',
    './AssetSelectorWidget': './src/widgets/AssetSelector.tsx',
    './OrganizationSelectorWidget': './src/widgets/OrganizationSelector.tsx',
  }
});