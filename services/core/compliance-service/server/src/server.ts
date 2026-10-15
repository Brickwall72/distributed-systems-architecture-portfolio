// File: services/core/compliance-service/server/src/server.ts
import express from 'express';
import { ZodError } from 'zod';
import { createComplianceGateway } from './routes';
import { initDatabase, pool } from './db/database';
import { createLogger } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { ESignEventConsumer } from './messaging/consumer';
import { ComplianceDocumentRepository } from './db/documents.repository';
import { env } from './config';

const app = express();
const logger = createLogger('compliance-server');

let isReady = false;

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// ==========================================
// CENTRALIZED EXPRESS ERROR MIDDLEWARE
// ==========================================
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    logger.warn(`Schema validation failed at API boundary: ${JSON.stringify(err.issues)}`);
    return res.status(400).json({
      errorCode: 'VALIDATION_ERROR',
      message: 'Invalid request payload or parameters.',
      details: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Critical unhandled fault intercepted at root layer: ${message}`);

  return res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the compliance gateway container context.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Boots application dependencies (DB pool, JetStream consumer) and instantiates gateway routes.
 */
async function bootstrapApplicationServer() {
  const broker = new EventBroker(env.NATS_URL, logger);
  let server: ReturnType<typeof app.listen>;

  const shutdown = (signal: string) => {
    isReady = false;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await broker.disconnect();
        logger.info('NATS broker connection closed cleanly.');

        await pool.end();
        logger.info('Database connection pool drained and closed.');

        clearTimeout(forceExitTimeout);
        process.exit(0);
      } catch (err) {
        logger.error(`Error during shutdown cleanup: ${err}`);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
    shutdown('unhandledRejection');
  });

  try {
    await initDatabase();
    logger.info('Compliance database connection established.');

    const repository = new ComplianceDocumentRepository(pool);

    await broker.connect();

    const esignConsumer = new ESignEventConsumer(broker, repository);
    await esignConsumer.start();
    logger.info('NATS JetStream event consumer listening for esign events.');

    // ✅ Pass broker explicitly into the compliance gateway factory
    const complianceGateway = createComplianceGateway({ broker });
    app.use('/api/v1', complianceGateway);

    server = app.listen(env.PORT, '0.0.0.0', () => {
      isReady = true;
      logger.info(`Compliance Server running on port ${env.PORT}`);
    });
  } catch (err) {
    logger.error(`Failed to initialize application dependencies: ${err}`);
    process.exit(1);
  }
}

if (env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;