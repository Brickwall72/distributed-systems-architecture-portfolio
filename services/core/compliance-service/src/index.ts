// File: services/core/compliance-service/src/index.ts
import express from 'express';
import { complianceGateway } from './gateway.js';
import { createHealthCheck, createLogger } from '@portfolio/telemetry';

const app = express();
const PORT = process.env.PORT || 8080;
const logger = createLogger('compliance-service');

app.disable('x-powered-by'); //reducing attack surface
app.use(express.json());


app.get('/health', createHealthCheck('compliance-service')); //Service life-sign for Kubernetes

app.use('/api/v1/compliance', complianceGateway);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);
  
  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the compliance gateway container context.',
    timestamp: new Date().toISOString()
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Subsystem actively listening on port ${PORT}`);
  });
}

export default app;
