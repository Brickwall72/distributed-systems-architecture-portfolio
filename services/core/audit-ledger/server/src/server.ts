// File: services/core/audit-ledger/server/src/server.ts
import express from 'express';
import { ZodError } from 'zod';
import { createAuditGateway } from './routes';
import { connectDatabaseWithRetry, closeDatabase } from './db';
import { createLogger, createVerifyJwt, loadAuthPublicKeyPem } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { LedgerService, RenditionService } from './services';
import { EventsRepository, DraftsRepository, SealedTransfersRepository, DeadLettersRepository, RenditionsRepository } from './repositories';
import { ObjectStorageClient } from '@shared/filestore';
import { AuditEventConsumer } from './messaging';
import { env } from './config';

const app = express();
const logger = createLogger('audit-server');

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
    message: 'An unexpected processing fault occurred within the audit gateway container context.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Boots application dependencies (DB pool, NATS stream/consumer/publisher) and instantiates gateway routes.
 */
async function bootstrapApplicationServer() {
  const broker = new EventBroker(env.NATS_URL, logger);
  let server: ReturnType<typeof app.listen>;
  let renditionService: RenditionService | undefined;

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await renditionService?.stop();
        await broker.disconnect();
        logger.info('NATS broker connection closed cleanly.');

        await closeDatabase();
        logger.info('Database connection closed.');

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
    const db = await connectDatabaseWithRetry();
    logger.info('Audit ledger database connection established.');

    await broker.connect();
    const sealed = new SealedTransfersRepository(db);
    const renditions = new RenditionsRepository(db);
    renditionService = new RenditionService(sealed, renditions, broker);
    const storage = new ObjectStorageClient({
      endpoint: env.S3_PUBLIC_ENDPOINT, region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY, forcePathStyle: true,
    });
    const ledgerService = new LedgerService({
      events: new EventsRepository(db),
      drafts: new DraftsRepository(db),
      sealed,
      deadLetters: new DeadLettersRepository(db),
      renditions,
      onSealed: () => renditionService?.nudge(),
      getSignedDownloadUrl: (request) => storage.getSignedDownloadUrl(request),
    });
    await new AuditEventConsumer(broker, ledgerService).start();
    renditionService.start();

    app.use('/api/v1', createVerifyJwt({ publicKeyPem: loadAuthPublicKeyPem(), publicPaths: ['/health'] }), createAuditGateway({ ledgerService }));

    server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`Audit Server running on port ${env.PORT}`);
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