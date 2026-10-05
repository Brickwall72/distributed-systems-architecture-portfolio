// File: services/platform/esignature-service/server/src/routes/index.ts
import { Router } from 'express';
import { router as signatureRoute } from './signature';
import { createHealthCheck } from '@shared/telemetry';


export const router = Router();

router.get('/health', createHealthCheck('esign-server'));
router.use('/signature', signatureRoute);