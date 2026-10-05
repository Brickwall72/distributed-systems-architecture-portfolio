// File: services/platform/pdf-generator/server/src/server.ts
import express from 'express';
import { router as pdfRouter } from './routes';
import { createLogger, createErrorHandler } from '@shared/express';

const app = express();
const logger = createLogger('pdf-server');

app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));

// Mount domain routers under a versioned prefix
app.use('/api/v1', pdfRouter);

app.use(createErrorHandler(logger));

if (process.env.NODE_ENV !== 'test') {
  const PORT = 8080;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`PDF Generator Microservice running on port ${PORT}`);
  });
}

export default app;