// File: services/core/compliance-service/server/src/routes/templates.ts
import { Router, Request, Response } from 'express';
import { createLogger } from '@shared/telemetry';
import { TemplateRepository } from '../repositories/TemplateRepository.js';

const router = Router();
const logger = createLogger('compliance-service:templates');

/**
 * GET /api/v1/compliance/templates
 * Returns a lightweight manifest of available templates for UI dropdowns.
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;
  logger.info('Fetching compliance template manifest', correlationId);

  const manifest = TemplateRepository.findAll().map(t => ({
    id: t.id,
    name: t.name,
  }));
  
  res.json(manifest);
});

/**
 * GET /api/v1/compliance/templates/:id
 * Returns the raw HTML string for the requested template.
 */
router.get('/:id', (req: Request, res: Response): void => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const correlationId = (req.headers['x-correlation-id'] as string) || null;
  
  const templateRecord = TemplateRepository.findById(templateId);

  if (!templateRecord) {
    logger.warn(`Template lookup failed: [${templateId}] not found`, correlationId);
    res.status(404).json({ error: `Template [${templateId}] not found.` }); // Updated to 404
    return;
  }

  logger.info(`Serving raw template content for [${templateId}]`, correlationId);
  res.setHeader('Content-Type', 'text/html');
  res.send(templateRecord.html);
});

export { router as templateRoutes };