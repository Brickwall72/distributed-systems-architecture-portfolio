// File: services/platform/pdf-generator/server/src/index.ts
import express from 'express';
import cors from 'cors';
import { pdfRouter } from './routes/pdf.routes.js';
import { createHealthCheck, createLogger } from '@shared/telemetry';

export const app = express();
const logger = createLogger('pdf-generator-api');

app.disable('x-powered-by');

const allowedOrigins = new Set<string>([
  'http://localhost:3000',
  'http://localhost:3020',
  'http://localhost:6006',
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
}));

app.use(express.json({ limit: '10mb' }));

// Mount infrastructure endpoints
app.get('/health', createHealthCheck('pdf-generator'));

// Mount domain routers under a versioned prefix
app.use('/api/v1/pdf', pdfRouter);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4001;
  app.listen(PORT, () => {
    logger.info(`PDF Generator Microservice running on port ${PORT}`);
  });
}