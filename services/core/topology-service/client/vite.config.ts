// File: services/core/topology-service/client/vite.config.ts
import { createRemoteConfig } from '@shared/vite-config';

export default createRemoteConfig({
  name: 'topology_service',
  port: Number.parseInt(process.env.CLIENT_PORT || '3011'),
  exposes: {
    './Widget': './src/widgets/TopologyCanvas.tsx',
  },
});