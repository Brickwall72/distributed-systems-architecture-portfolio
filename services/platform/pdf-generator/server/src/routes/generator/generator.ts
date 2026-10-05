// File: services/platform/pdf-generator/server/src/routes/generator/generator.ts
import { Router, Request, Response } from 'express';
import { generatePdfFromHtml, uploadGeneratedDocument } from '../../services';
import { createLogger } from '@shared/express';
import { randomUUID } from 'node:crypto';

export const router = Router();
const logger = createLogger('pdf-server');

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;

  try {
    const { html, documentId, entityId, customPath } = req.body;

    if (!html || typeof html !== 'string') {
      logger.warn('Rejecting request: Missing or invalid HTML payload', correlationId);
      res.status(400).json({ error: 'Raw HTML string payload is required' });
      return;
    }

    logger.info('Received PDF generation request', correlationId);

    // 1. Generate PDF binary buffer
    const pdfBuffer = await generatePdfFromHtml(html, correlationId);

    // 2. Fallback or structured metadata for MinIO persistence
    const targetEntityId = entityId || 'system';
    const targetDocumentId = documentId || randomUUID();

    logger.debug(`Persisting generated PDF for entity: ${targetEntityId}, doc: ${targetDocumentId}`, correlationId);

    const storageMetadata = await uploadGeneratedDocument({
      pdfBuffer,
      entityId: targetEntityId,
      documentId: targetDocumentId,
      customPath,
      correlationId,
    });

    // 3. Return binary response with storage details in headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Document-S3-URI', storageMetadata.s3Uri);
    res.setHeader('X-Document-ID', targetDocumentId);

    res.end(pdfBuffer);
    logger.info('Successfully generated, uploaded, and returned PDF', correlationId);
  } catch (error: any) {
    logger.error(`PDF Generation Failed: ${error.message}`, correlationId);
    res.status(500).json({ error: `PDF Generation Failed: ${error.message}` });
  }
});