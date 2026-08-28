// File: services/core/topology-service/src/topologyServer.ts
import express from 'express';
import { createHealthCheck, createLogger } from '@shared/telemetry';
import { topologyGateway } from './topologyGateway.js';
import { initializeDatabaseConnection, terminateDatabaseClient } from './topologyDatabase.js';

const app = express();
const PORT = process.env.PORT || 8081;
const logger = createLogger('topology-service');

/* Disable the default Express fingerprint header. This is a small but useful hardening step for
the platform because the service sits on a validation boundary and should not reveal framework
internals to reconnaissance tooling. */
app.disable('x-powered-by');

/* The topology service accepts strict JSON bodies when validating relationships, consistent with
ADR-004 and the ICD contract that keeps sensitive identifiers out of URL query strings. */
app.use(express.json());

/* Container health endpoint used by orchestrators and deployment monitors to verify that the
 * service is alive before routing real business traffic through the validation gate. */
app.get('/health', createHealthCheck('topology-service'));

// Mount the actual business API under the versioned topology namespace defined in the ICD.
app.use('/api/v1/topology', topologyGateway);

/* Safety net for unhandled exceptions. The compliance flow depends on predictability, so a
 generic internal-server error is returned instead of exposing a stack trace or partial state. */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);

  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the topology service container context.',
    timestamp: new Date().toISOString()
  });
});

/**
 * Starts the server lifecycle after the graph driver has been initialized. The order matters:
 * the service should not begin accepting validation calls until the database and its seed graph
 * are healthy enough to answer the compliance gate.
 */
async function bootstrapApplicationServer() {
  try {
    /* ADR-006 keeps service-local deployment concerns isolated. The local compose file can bring
     up Neo4j independently, but this server still waits for the graph to become healthy before
     opening HTTP traffic. */
    if (process.env.NODE_ENV !== 'test') {
      await initializeDatabaseConnection();
    }

    // Begin serving business requests on the designated port for the validation workflow.
    app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[topology-server] Safe isolated execution thread pool listening on port ${PORT}`);
});
  } catch (error_: any) {
    logger.error(`Subsystem container failed to boot cleanly: ${error_.message}`);
    process.exit(1);
  }
}

// Graceful shutdown: drain the DB client and stop the process without leaving pool sockets open.
process.on('SIGTERM', async () => {
  logger.info('Intercepted SIGTERM container kill signal. Initializing graceful exit sequence...');
  await terminateDatabaseClient();
  process.exit(0);
});

/* Skip automatic bootstrapping during test execution so unit tests can mount the app without
 connecting to the Neo4j container. In the production runtime, top-level await is used so the
 server does not begin accepting traffic before the database and seed graph are ready. */
if (process.env.NODE_ENV !== 'test') {
  await bootstrapApplicationServer();
}

export default app;
