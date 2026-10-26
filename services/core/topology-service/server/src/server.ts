// File: services/core/topology-service/server/src/server.ts
import express from 'express';
import { createLogger } from '@shared/express';
import { EventBroker } from '@shared/messaging';
import { createTopologyGateway } from './routes';
import { TransfersRepository } from './repositories';
import { TransferService } from './services';
import { ComplianceEventConsumer, TopologyPublisher } from './messaging';
import {
  initializeDatabaseConnection, terminateDatabaseClient,
  getDatabaseClient, seedSpaceCustodyGraphTopology
} from './database';

const app = express();
const PORT = 8080;
const logger = createLogger('topology-server');

app.disable('x-powered-by');
app.use(express.json());

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
  const broker = new EventBroker(natsUrl, logger);
  let server: ReturnType<typeof app.listen>;

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initializing graceful shutdown...`);
    try {
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
    if (process.env.NODE_ENV !== 'test') {
      const driver = await initializeDatabaseConnection();
      await seedSpaceCustodyGraphTopology(driver);
    }

    // Connect NATS Event Broker and start Topology Event Consumer
    await broker.connect();
    logger.info('NATS broker connected.');

    const transfersRepository = new TransfersRepository(getDatabaseClient());
    const publisher = new TopologyPublisher(broker);
    await publisher.init();
    const transferService = new TransferService(transfersRepository, publisher);
    const topologyConsumer = new ComplianceEventConsumer(broker, transferService);
    await topologyConsumer.start();
    logger.info('Topology event consumer started and listening for transfer events.');

    // ✅ Instantiate routes ONLY after dependencies initialize successfully
    const topologyGateway = createTopologyGateway();
    app.use('/api/v1', topologyGateway);

    server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Safe isolated execution thread pool listening on port ${PORT}`);
    });
  } catch (error_: any) {
    logger.error(`Subsystem container failed to boot cleanly: ${error_?.message || error_}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;