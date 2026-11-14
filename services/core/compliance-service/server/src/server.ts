// File: services/core/compliance-service/server/src/server.ts
import express from 'express';
import { ZodError } from 'zod';
import { createComplianceGateway } from './routes';
import { initializeDatabaseWithRetry, pool } from './db';
import { createLogger, createVerifyJwt, loadAuthPublicKeyPem } from '@shared/express';
import { EventBroker, natsCredentialsFromEnv } from '@shared/messaging';
import { TransferService, NatsSigningCoordinator, SignedOutboxService } from './services';
import { DocumentsRepository, SigningOperationsRepository, SignedOutboxRepository } from './repositories';
import { ComplianceEventConsumer, TopologyNatsClient } from './messaging';
import { COMPLIANCE_EVENT_SUBJECTS } from '@contracts/compliance';
import { env } from './config';
import { publicStorageClient } from './services/storage';

const app = express();
const logger = createLogger('compliance-server');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.get('/live', (_req, res) => res.sendStatus(200));

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
 * Boots application dependencies (DB pool, NATS stream/consumer/publisher) and instantiates gateway routes.
 */
async function bootstrapApplicationServer() {
  const credentials = natsCredentialsFromEnv(process.env);
  if (!credentials) throw new Error('Authenticated NATS service credentials are required');
  const broker = new EventBroker(env.NATS_URL, logger, credentials);
  let server: ReturnType<typeof app.listen> | undefined;
  const startup = new AbortController();
  let signingCoordinator: NatsSigningCoordinator | undefined;
  let signedOutbox: SignedOutboxService | undefined;

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    startup.abort();

    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);

    const cleanup = async () => {
      logger.info('HTTP server closed.');
      try {
        await signingCoordinator?.stop();
        await signedOutbox?.stop();
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
    };
    if (server) server.close(() => void cleanup());
    else void cleanup();
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
    server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`Compliance liveness endpoint listening on port ${env.PORT}`);
    });
    await initializeDatabaseWithRetry();
    logger.info('Compliance database connection established.');

    await broker.connect();
    await broker.ensureStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL]);
    const repository = new DocumentsRepository(pool);
    const transferService = new TransferService(repository);
    const consumer = new ComplianceEventConsumer(broker, transferService);
    await consumer.start(startup.signal);

    const topology = new TopologyNatsClient(broker);
    const signingOperations = new SigningOperationsRepository(pool);
    const signedOutboxRepository = new SignedOutboxRepository(pool);
    signedOutbox = new SignedOutboxService(signedOutboxRepository, broker);
    signedOutbox.start();
    signingCoordinator = new NatsSigningCoordinator(signingOperations, topology, broker, signedOutboxRepository);
    signingCoordinator.start();
    const complianceGateway = createComplianceGateway({
      broker, repository, topology, signingOperations, signingCoordinator,
      getSignedDownloadUrl: (request) => publicStorageClient.getSignedDownloadUrl(request),
    });
    app.use('/api/v1', createVerifyJwt({ publicKeyPem: loadAuthPublicKeyPem(), publicPaths: ['/health'] }), complianceGateway);

    logger.info('Compliance server is ready.');
  } catch (err) {
    if (startup.signal.aborted) return;
    logger.error(`Failed to initialize application dependencies: ${err}`);
    process.exit(1);
  }
}

if (env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;