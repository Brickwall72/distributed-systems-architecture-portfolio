// File: services/platform/esignature-service/server/src/server.ts
import express from 'express';
import { router as esignRouter } from './routes';
import { createLogger, createErrorHandler } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { ESignPublisher, setESignPublisher } from './messaging/publisher';
import { env } from './config';

const app = express();
const logger = createLogger('esign-server');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.use('/api/v1', esignRouter);

app.use(createErrorHandler(logger));

if (process.env.NODE_ENV !== 'test') {
  const broker = new EventBroker(env.NATS_URL, logger);
  await broker.connect();

  const publisher = new ESignPublisher(broker);
  await publisher.init();
  
  // Register instance cleanly without exporting a mutable binding
  setESignPublisher(publisher);
  logger.info('NATS JetStream ESign Publisher initialized.');

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