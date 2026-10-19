// File: services/platform/esignature-service/server/src/server.ts
import express from 'express';
import { createLogger, createErrorHandler, createHealthCheck } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { registerESignResponder } from './messaging';
import { env } from './config';

const app = express();
const logger = createLogger('esign-server');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.get('/api/v1/health', createHealthCheck('esign-server'));

app.use(createErrorHandler(logger));

if (process.env.NODE_ENV !== 'test') {
  const broker = new EventBroker(env.NATS_URL, logger);
  await broker.connect();

  registerESignResponder(broker);
  logger.info('NATS Event Broker connected and responder created.');

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`E-Sign Microservice running on port ${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await broker.disconnect();
        logger.info('NATS broker disconnected cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error disconnecting NATS broker: ${err}`);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;