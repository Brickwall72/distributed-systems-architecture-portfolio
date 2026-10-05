// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
// import { authorizationsRouter } from './authorizations.js';
import { router as templateRoutes } from './templates';
import documentsRouter from './documents';
import { createHealthCheck } from '@shared/express';

const router = Router();

/* Container health endpoint used by orchestrators and deployment monitors to verify that the
 * service is alive before routing real business traffic through the validation gate. */
router.get('/health', createHealthCheck('compliance-server'));
router.use('/templates', templateRoutes);
router.use('/documents', documentsRouter);

export { router as complianceGateway };