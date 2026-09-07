// File: services/core/topology-service/server/src/routes/assets.unit.test.ts
import { assetsRouter } from './assets.js';
import { runStandardRouteTests } from '../utils/test-helpers';

runStandardRouteTests({
  routeName: 'Assets',
  endpointPath: '/assets',
  router: assetsRouter,
});