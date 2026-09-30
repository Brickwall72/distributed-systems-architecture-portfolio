// File: services/core/compliance-service/server/src/routes/documents.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateComplianceDocumentSchema } from '@contracts/compliance';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';
import { pool } from '../db/database.js';
import { createLogger } from '@shared/telemetry';

const router = Router();
const logger = createLogger('compliance-server:documents');
const repository = new ComplianceDocumentRepository(pool);

const IdParamSchema = z.object({
  id: z.uuid({ message: 'Invalid document UUID format' }),
});

// POST /api/v1/documents - Create compliance document metadata
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createPayload = CreateComplianceDocumentSchema.parse(req.body);
    const document = await repository.create(createPayload);

    logger.info(`Compliance record created for document: ${document.id}`);
    return res.status(201).json({
      success: true,
      data: document,
    });
  } catch (err) {
    logger.error(`Failed to register compliance document: ${err}`);
    return next(err);
  }
});

// GET /api/v1/documents - List all compliance documents
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Retrieving all compliance records from database.');
    const documents = await repository.findAll();
    return res.json(documents);
  } catch (error) {
    logger.error(`Database query failed in GET /documents: ${error}`);
    return next(error);
  }
});

// GET /api/v1/documents/:id - Get a single compliance document by UUID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    logger.debug(`Retrieving compliance document record for ID: ${id}`);

    const document = await repository.findById(id);

    if (!document) {
      return res.status(404).json({
        errorCode: 'NOT_FOUND',
        message: `Compliance document with ID '${id}' was not found.`,
      });
    }

    return res.json(document);
  } catch (error) {
    logger.error(`Database query failed in GET /documents/:id: ${error}`);
    return next(error);
  }
});

export default router;