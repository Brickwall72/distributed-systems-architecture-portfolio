// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createHealthCheck } from '@shared/express';
import { complianceContract } from 'compliance-shared';
import { createTemplatesRouter } from './templates';
import documentsRouter from './documents';

export function createComplianceGateway(): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors */
  router.get('/health', createHealthCheck('compliance-server'));

  // Defer router creation until this factory function is invoked inside bootstrapApplicationServer
  const templatesRouter = createTemplatesRouter();

  createExpressEndpoints(
    complianceContract,
    {
      ...templatesRouter,
    },
    router
  );

  // Traditional Express sub-routers (mounted relative to /api/v1 -> /api/v1/documents)
  router.use('/documents', documentsRouter);

  return router;
}

export { createComplianceGateway as complianceGateway };