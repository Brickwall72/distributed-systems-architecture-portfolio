// File: services/platform/pdf-generator/server/src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { generatePdfFromTemplate } from './services/pdfService.js';
import { createHealthCheck, createLogger } from '@shared/telemetry';

export const app = express();
const logger = createLogger('topology-service');
app.disable('x-powered-by');
// Define allowed front-end shells/origins
const allowedOrigins = new Set<string> ([
  'http://localhost:3000', // Example shell port
  'http://localhost:3020',
  'http://localhost:6006', // Another shell / Vite dev server
  // Add your production domains here later or via environment variables
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server calls)
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    }
  },
  methods: ['POST', 'OPTIONS'], // Restrict methods strictly to what's needed
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get('/health', createHealthCheck('pdf-generator'));

app.post('/api/v1/pdf/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId = 'satellite-compliance-report', data } = req.body;

    if (!data) {
      res.status(400).json({ error: 'Data payload is required' });
      return;
    }

    const pdfBuffer = await generatePdfFromTemplate(templateId, data);

    // Stream the binary PDF straight back to the client memory
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="report.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.end(pdfBuffer);
  } catch (error: any) {
    logger.error('PDF Generation Error:', error);
    res.status(500).json({ error: `PDF Generation Failed: ${error.message}` });
  }
});

/* Safety net for unhandled exceptions. The compliance flow depends on predictability, so a
 generic internal-server error is returned instead of exposing a stack trace or partial state. */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);

  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the pdf-generator service container context.',
    timestamp: new Date().toISOString()
  });
});

// Only start listener when executed directly
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4001;
  app.listen(PORT, () => {
    console.log(`PDF Generator Microservice running on port ${PORT}`);
  });
}