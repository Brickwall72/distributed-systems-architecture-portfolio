// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createHealthCheck } from '@shared/express';
import { complianceContract } from 'compliance-shared';
import { createTemplatesRouter } from './templates';
import { createDocumentsRouter } from './documents';
import { EventBroker } from '@shared/messaging';

interface ComplianceGatewayDeps {
  broker: EventBroker;
}

export function createComplianceGateway(deps: ComplianceGatewayDeps): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors */
  router.get('/health', createHealthCheck('compliance-server'));

  const templatesRouter = createTemplatesRouter({ broker: deps.broker });
  const documentsRouter = createDocumentsRouter({ broker: deps.broker });

  createExpressEndpoints(
    complianceContract,
    {
      ...templatesRouter,
      ...documentsRouter,
    },
    router
  );

  return router;
}

export { createComplianceGateway as complianceGateway };