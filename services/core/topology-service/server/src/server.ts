// File: services/core/topology-service/server/src/server.ts
import express from 'express';
import { createLogger } from '@shared/express';
import { createTopologyGateway } from './routes/index.js';
import { initializeDatabaseConnection, terminateDatabaseClient } from './topologyDatabase.js';

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
 * Starts the server lifecycle after the graph driver has been initialized.
 */
async function bootstrapApplicationServer() {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await initializeDatabaseConnection();
    }

    // ✅ Instantiate routes ONLY after database connection initialization completes
    const topologyGateway = createTopologyGateway();
    app.use('/api/v1', topologyGateway);

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`[topology-server] Safe isolated execution thread pool listening on port ${PORT}`);
    });
  } catch (error_: any) {
    logger.error(`Subsystem container failed to boot cleanly: ${error_.message}`);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Intercepted SIGTERM container kill signal. Initializing graceful exit sequence...');
  await terminateDatabaseClient();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;