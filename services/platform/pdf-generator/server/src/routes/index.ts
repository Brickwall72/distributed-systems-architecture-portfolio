// File: services/platform/pdf-generator/server/src/routes/index.ts
import { Router } from 'express';
import { createHealthCheck } from '@shared/express';
import { router as generatorRoute } from './generator';

export const router = Router();

router.get('/health', createHealthCheck('pdf-server'));
router.use('/generator', generatorRoute);