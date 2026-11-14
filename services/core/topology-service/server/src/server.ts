// File: services/core/topology-service/server/src/server.ts
import express from 'express';
import { createLogger, createVerifyJwt, loadAuthPublicKeyPem } from '@shared/express';
import { EventBroker, natsCredentialsFromEnv } from '@shared/messaging';
import { createTopologyGateway } from './routes';
import { TransferOutboxService } from './services';
import { TransferOutboxRepository, TransferClaimsRepository, TransferDraftRepository } from './repositories';
import { registerTransferRequestResponders, startSignedTransferConsumer } from './messaging';
import { TOPOLOGY_EVENT_SUBJECTS } from '@contracts/topology';
import {
  initializeDatabaseConnection, terminateDatabaseClient,
  getDatabaseClient, seedSpaceCustodyGraphTopology
} from './database';

const app = express();
const PORT = 8080;
const logger = createLogger('topology-server');

app.disable('x-powered-by');
app.use(express.json());
app.get('/live', (_req, res) => res.sendStatus(200));

/* Safety net for unhandled exceptions. */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);

  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the topology service container context.',
    timestamp: new Date().toISOString()
  });
});

/**
 * Starts the server lifecycle after the graph driver and NATS broker have been initialized.
 */
async function bootstrapApplicationServer() {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  const credentials = natsCredentialsFromEnv(process.env);
  if (!credentials) throw new Error('Authenticated NATS service credentials are required');
  const broker = new EventBroker(natsUrl, logger, credentials);
  let server: ReturnType<typeof app.listen>;
  let outbox: TransferOutboxService | undefined;
  const startup = new AbortController();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initializing graceful shutdown...`);
    startup.abort();
    try {
      await outbox?.stop();
      await broker.disconnect();
      logger.info('NATS broker connection closed cleanly.');

      await terminateDatabaseClient();
      logger.info('Database client terminated.');

      if (server) {
        server.close(() => {
          logger.info('HTTP server closed.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    } catch (err) {
      logger.error(`Error during shutdown cleanup: ${err}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Topology liveness endpoint listening on port ${PORT}`);
    });
    if (process.env.NODE_ENV !== 'test') {
      const driver = await initializeDatabaseConnection();
      await seedSpaceCustodyGraphTopology(driver);
    }

    // Connect NATS Event Broker and start Topology Event Consumer
    await broker.connect();
    logger.info('NATS broker connected.');

    await broker.ensureStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL]);
    outbox = new TransferOutboxService(new TransferOutboxRepository(getDatabaseClient()), broker);
    outbox.start();
    const claims = new TransferClaimsRepository(getDatabaseClient());
    registerTransferRequestResponders(broker, claims, new TransferDraftRepository(getDatabaseClient()));
    await broker.flush();
    await startSignedTransferConsumer(broker, claims, startup.signal);

    // ✅ Instantiate routes ONLY after dependencies initialize successfully
    const topologyGateway = createTopologyGateway();
    app.use('/api/v1', createVerifyJwt({ publicKeyPem: loadAuthPublicKeyPem(), publicPaths: ['/health'] }), topologyGateway);

    logger.info('Topology server is ready.');
  } catch (error_: any) {
    if (startup.signal.aborted) return;
    logger.error(`Subsystem container failed to boot cleanly: ${error_?.message || error_}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;