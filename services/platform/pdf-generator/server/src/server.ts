// File: services/platform/pdf-generator/server/src/server.ts
import express from 'express';
import { pdfRouter } from './routes/pdf.routes.js';
import { createLogger } from '@shared/telemetry';

const app = express();
const logger = createLogger('pdf-server-api');

app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));

// Mount domain routers under a versioned prefix
app.use('/api/v1/pdf', pdfRouter);

if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT) || 4001;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`PDF Generator Microservice running on port ${PORT}`);
  });
}

export default app;