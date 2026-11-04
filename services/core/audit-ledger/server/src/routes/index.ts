// File: services/core/audit-ledger/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints } from '@ts-rest/express';
import { createHealthCheck } from '@shared/express';
import { auditContract } from 'audit-shared';
import { z } from 'zod';
import { createTransfersRouter, transfersRouterDepsSchema } from './transfers';

export const auditGatewayDepsSchema = z.object({
  ...transfersRouterDepsSchema.shape,
});
type AuditGatewayDeps = z.infer<typeof auditGatewayDepsSchema>;

export function createAuditGateway(deps: AuditGatewayDeps): Router {
  const router = Router();

  /* Container health endpoint used by orchestrators and deployment monitors */
  router.get('/health', createHealthCheck('audit-server'));

  const transfersRouter = createTransfersRouter(transfersRouterDepsSchema.parse(deps));

  createExpressEndpoints(auditContract, { ...transfersRouter }, router);

  return router;
}

export { createAuditGateway as auditGateway };
