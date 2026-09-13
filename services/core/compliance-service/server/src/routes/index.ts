// File: services/core/compliance-service/server/src/routes/index.ts
import { Router } from 'express';
// import { authorizationsRouter } from './authorizations.js';
import templateRoutes from './templates.js';
import documentsRouter from './documents.js';
import { createHealthCheck } from '@shared/telemetry';

const router = Router();

/* Container health endpoint used by orchestrators and deployment monitors to verify that the
 * service is alive before routing real business traffic through the validation gate. */
router.get('/health', createHealthCheck('compliance-server'));
router.use('/templates', templateRoutes);
router.use('/documents', documentsRouter);

export default router;