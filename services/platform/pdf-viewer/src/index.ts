import express from 'express';
import { streamRouter } from './routes/stream.js';

const app = express();
const PORT = process.env.PORT || 8084;

// SECURITY REMEDIATION: Disable framework fingerprinting headers permanently
app.disable('x-powered-by');

// Global Middleware Pipeline
app.use(express.json());

// Standard Telemetry Probe Gate for Container Health Verification
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'HEALTHY', service: 'pdf-viewer' });
});

// Mount Functional Subsystem Routers
app.use('/v1/stream', streamRouter);

// Global Fallback Error Interceptor Middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[pdf-viewer] Critical unhandled fault intercepted:', err);
  
  // Enforce zero-stack trace leakages to prevent internal data exposure
  res.status(500).json({ 
    error: 'INTERNAL_SERVER_ERROR', 
    message: 'An unexpected processing fault occurred.' 
  });
});

app.listen(PORT, () => {
  console.log(`[pdf-viewer] Service actively listening on port ${PORT}`);
});

export default app;