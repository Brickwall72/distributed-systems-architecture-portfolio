// File: services/core/topology-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createOrganizationsRouter } from './organizations';
import { createAssetsRouter } from './assets';
import { entitiesRouter } from './entities';
import { createHealthCheck } from '@shared/express';
import { topologyContract } from 'topology-shared';

export function createTopologyGateway(): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors to verify that the
   * service is alive before routing real business traffic through the validation gate. */
  router.get('/health', createHealthCheck('topology-server'));
  
  // router.use('/authorizations', authorizationsRouter);
  const organizationsRouter = createOrganizationsRouter();
  // Defer router creation until this factory function is invoked
  const assetsRouter = createAssetsRouter();
  createExpressEndpoints(
    topologyContract,
    {
      ...assetsRouter,
      ...organizationsRouter,
    },
    router
  );

  router.use('/entities', entitiesRouter);

  return router;
}