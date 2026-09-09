// File: services/core/topology-service/server/src/routes/index.ts
import { Router } from 'express';
// import { authorizationsRouter } from './authorizations.js';
import { organizationsRouter } from './organizations.js';
import { assetsRouter } from './assets.js';
import { entitiesRouter } from './entities.js';
import { createHealthCheck } from '@shared/telemetry';

const router = Router();

/* Container health endpoint used by orchestrators and deployment monitors to verify that the
 * service is alive before routing real business traffic through the validation gate. */
router.get('/health', createHealthCheck('topology-server'));
// router.use('/authorizations', authorizationsRouter);
router.use('/organizations', organizationsRouter);
router.use('/assets', assetsRouter);
router.use('/entities', entitiesRouter);

export { router as topologyGateway };