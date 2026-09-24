// File: services/core/compliance-service/server/src/server.ts
import express from 'express';
import { complianceGateway } from './routes/index.js';
import { initDatabase } from './db/database.js';
import { createLogger } from '@shared/telemetry';

const app = express();
const logger = createLogger('compliance-server');

app.disable('x-powered-by'); //reducing attack surface
app.use(express.json({ limit: '10mb' }));

app.use('/api/v1', complianceGateway);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Critical unhandled fault intercepted at root layer: ${err.message || err}`);
  
  res.status(500).json({
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected processing fault occurred within the compliance gateway container context.',
    timestamp: new Date().toISOString()
  });
});

// Initialize DB and start server
const PORT = 8080
await initDatabase();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Compliance Server running on port ${PORT}`);
});

export default app;
