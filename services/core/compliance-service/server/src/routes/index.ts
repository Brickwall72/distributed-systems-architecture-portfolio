// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createHealthCheck } from '@shared/express';
import { complianceContract } from 'compliance-shared';
import { createTemplatesRouter, type TemplatesRouterDeps } from './templates';
import { createDocumentsRouter, type DocumentsRouterDeps } from './documents';

type ComplianceGatewayDeps = TemplatesRouterDeps & DocumentsRouterDeps;

export function createComplianceGateway(deps: ComplianceGatewayDeps): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors */
  router.get('/health', createHealthCheck('compliance-server'));

  const templatesRouter = createTemplatesRouter(deps);
  const documentsRouter = createDocumentsRouter(deps);

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