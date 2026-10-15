// File: services/platform/pdf-generator/server/src/server.ts
import express from 'express';
import { createHealthCheck, createErrorHandler, createLogger } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { registerPdfResponder } from './messaging';
import { env } from './config';

const app = express();
const logger = createLogger('pdf-server');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// Minimal health check endpoint for container orchestration / k3d probes
app.get('/api/v1/health', createHealthCheck('pdf-server'));

app.use(createErrorHandler(logger));

async function bootstrapPdfService() {
  const broker = new EventBroker(env.NATS_URL, logger);
  let server: ReturnType<typeof app.listen>;

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down PDF server...`);
    try {
      await broker.disconnect();
      logger.info('NATS broker connection closed.');
      server.close(() => {
        logger.info('HTTP health server closed.');
        process.exit(0);
      });
    } catch (err) {
      logger.error(`Error during shutdown: ${err}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    // 1. Connect to NATS
    await broker.connect();
    logger.info(`Connected to NATS Broker at ${env.NATS_URL}`);

    // 2. Register NATS Request-Reply Responder
    registerPdfResponder(broker);

    // 3. Start HTTP server strictly for health probes
    const PORT = env.PORT;
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`PDF Generator Microservice running health probes on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`Failed to bootstrap PDF generator service: ${err}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  await bootstrapPdfService();
}

export default app;