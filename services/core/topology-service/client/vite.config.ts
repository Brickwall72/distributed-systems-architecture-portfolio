// File: services/core/topology-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  domain: 'topology',
  concern: 'client',
  exposes: {
    './AssetRegistration': './src/widgets/AssetRegistration',
    './NetworkCanvas': './src/widgets/NetworkCanvas',
    './AssetSelector': './src/widgets/AssetSelector',
    './OrganizationSelector': './src/widgets/OrganizationSelector'
  }
});