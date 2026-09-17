// File: services/platform/esign-service/server/src/server.ts
import express from 'express';
import { esignRouter } from './routes/sign.js';
import { createLogger } from '@shared/telemetry';

const app = express();
const logger = createLogger('esign-server-api');

app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));

// Mount domain routers under a versioned prefix
app.use('/api/v1/esign', esignRouter);

if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT) || 4002;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`E-Sign Microservice running on port ${PORT}`);
  });
}

export default app;