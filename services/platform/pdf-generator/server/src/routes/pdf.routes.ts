// File: services/platform/pdf-generator/server/src/routes/pdf.routes.ts
import { Router, Request, Response } from 'express';
import { generatePdfFromHtml } from '../services/pdfService.js';
import { createLogger } from '@shared/telemetry';

const router = Router();
const logger = createLogger('pdf-generator-router');

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req.headers['x-correlation-id'] as string) || null;

  try {
    const { html } = req.body;

    if (!html || typeof html !== 'string') {
      logger.warn('Rejecting request: Missing or invalid HTML payload', correlationId);
      res.status(400).json({ error: 'Raw HTML string payload is required' });
      return;
    }

    logger.info('Received PDF generation request', correlationId);
    
    const pdfBuffer = await generatePdfFromHtml(html, correlationId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.end(pdfBuffer);
    logger.info('Successfully generated and returned PDF', correlationId);
  } catch (error: any) {
    logger.error(`PDF Generation Failed: ${error.message}`, correlationId);
    res.status(500).json({ error: `PDF Generation Failed: ${error.message}` });
  }
});

export const pdfRouter = router;