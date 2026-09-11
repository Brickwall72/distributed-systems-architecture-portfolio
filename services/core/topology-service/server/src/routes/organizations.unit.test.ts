// File: services/core/topology-service/server/src/routes/organizations.unit.test.ts
import { organizationsRouter } from './organizations';
import { runStandardRouteTests } from '@shared/testing';

runStandardRouteTests({
  routeName: 'Organizations',
  endpointPath: '/organizations',
  router: organizationsRouter,
});