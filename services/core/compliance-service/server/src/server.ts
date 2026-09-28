// File: services/core/compliance-service/server/src/server.ts
import express from 'express';
import { complianceGateway } from './routes/index.js';
import { initDatabase } from './db/database.js';
import { createLogger } from '@shared/telemetry';
import { EventBroker } from '@shared/messaging';
import { ESignEventConsumer } from './messaging/consumer.js';
import { env } from './config.js';

const app = express();
const logger = createLogger('compliance-server');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.use('/api/v1', complianceGateway);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);
  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the compliance gateway container context.',
    timestamp: new Date().toISOString(),
  });
});

// Guard side-effects from firing when imported during unit tests
if (process.env.NODE_ENV !== 'test') {
  await initDatabase();
  logger.info('Compliance database connection established.');

  const broker = new EventBroker(env.NATS_URL, logger);
  await broker.connect();

  const esignConsumer = new ESignEventConsumer(broker);
  await esignConsumer.start();
  logger.info('NATS JetStream event consumer listening for esign events.');

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Compliance Server running on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await broker.disconnect();
        logger.info('NATS broker connection closed cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during NATS broker disconnection: ${err}`);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;