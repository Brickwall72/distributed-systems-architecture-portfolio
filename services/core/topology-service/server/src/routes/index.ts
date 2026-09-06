// File: services/core/topology-service/server/src/routes/index.ts
import { Router } from 'express';
import { authorizationsRouter } from './authorizations.js';
import { organizationsRouter } from './organizations.js';
import { assetsRouter } from './assets.js';
import { entitiesRouter } from './entities.js';

const router = Router();

router.use('/authorizations', authorizationsRouter);
router.use('/organizations', organizationsRouter);
router.use('/assets', assetsRouter);
router.use('/entities', entitiesRouter);

export { router as topologyGateway };