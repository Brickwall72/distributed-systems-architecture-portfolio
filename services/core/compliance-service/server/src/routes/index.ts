// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createHealthCheck } from '@shared/express';
import { complianceContract } from 'compliance-shared';
import { createTemplatesRouter, templatesRouterDepsSchema } from './templates';
import { createDocumentsRouter, documentsRouterDepsSchema } from './documents';
import { z } from 'zod';

export const complianceGatewayDepsSchema = z.object({
  ...templatesRouterDepsSchema.shape,
  ...documentsRouterDepsSchema.shape,
})
type ComplianceGatewayDeps = z.infer<typeof complianceGatewayDepsSchema>;

export function createComplianceGateway(deps: ComplianceGatewayDeps): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors */
  router.get('/health', createHealthCheck('compliance-server'));

  const templatesRouter = createTemplatesRouter(templatesRouterDepsSchema.parse(deps));
  const documentsRouter = createDocumentsRouter(documentsRouterDepsSchema.parse(deps));

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