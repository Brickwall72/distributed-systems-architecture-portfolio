// File: services/core/topology-service/server/src/routes/assets.unit.test.ts
import { assetsRouter } from './assets.js';
import { runStandardRouteTests } from '@shared/testing';

runStandardRouteTests({
  routeName: 'Assets',
  endpointPath: '/assets',
  router: assetsRouter,
});