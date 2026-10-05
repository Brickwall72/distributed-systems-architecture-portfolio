// File: services/core/compliance-service/server/src/routes/templates/templates.ts
import { Router, Request, Response } from 'express';
import { createLogger } from '@shared/express';
import { TemplateRepository } from '../../repositories';

export const router = Router();
const logger = createLogger('compliance-server:templates');

/**
 * GET /compliance/api/v1/templates
 * Returns a lightweight manifest of available templates for UI dropdowns.
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;
  logger.info('Fetching compliance template manifest', correlationId);

  try {
    const manifest = TemplateRepository.findAll().map((t) => ({
      id: t.id,
      name: t.name,
    }));

    res.json(manifest);
  } catch (err) {
    logger.error(`Failed to fetch template manifest: ${err}`, correlationId);
    res.status(500).json({ error: 'Internal server error retrieving template manifest.' });
  }
});

/**
 * GET /compliance/api/v1/templates/:id
 * Returns the raw template content (supports application/json or text/html negotiation).
 */
router.get('/:id', (req: Request, res: Response): void => {
  const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const correlationId = (req.headers['x-correlation-id'] as string) || null;

  try {
    const templateRecord = TemplateRepository.findById(templateId);

    if (!templateRecord) {
      logger.warn(`Template lookup failed: [${templateId}] not found`, correlationId);
      res.status(404).json({ error: `Template [${templateId}] not found.` });
      return;
    }

    logger.info(`Serving template content for [${templateId}]`, correlationId);

    // If Pact consumer contract expects a full JSON object ({ id, name, html }):
    if (req.headers.accept?.includes('application/json')) {
      res.json(templateRecord);
      return;
    }

    // Default: serve raw string for iframe DocumentViewer hydration
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(templateRecord.html);
  } catch (err) {
    logger.error(`Error loading template [${templateId}]: ${err}`, correlationId);
    res.status(500).json({ error: `Internal server error loading template [${templateId}].` });
  }
});