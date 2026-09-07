// File: services/core/topology-service/server/src/routes/organizations.unit.test.ts
import { organizationsRouter } from './organizations';
import { runStandardRouteTests } from '../utils/test-helpers';

runStandardRouteTests({
  routeName: 'Organizations',
  endpointPath: '/organizations',
  router: organizationsRouter,
});