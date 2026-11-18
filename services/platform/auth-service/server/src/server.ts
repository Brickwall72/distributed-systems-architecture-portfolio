// File: services/platform/auth-service/server/src/server.ts
import express from 'express';
import { createPublicKey } from 'node:crypto';
import { createLogger, createRequestDiagnostics, safeErrorMetadata } from '@shared/express';
import { env, loadPrivateKeyPem } from './config';
import { createAuthGateway } from './routes';
import { TokenService } from './services/token.service';

const app = express();
const logger = createLogger('auth-server');

app.disable('x-powered-by');
// Behind Traefik/Tailscale Funnel; trust one hop so rate limiting sees the client address.
app.set('trust proxy', 1);
app.use(createRequestDiagnostics(logger));
app.use(express.json({ limit: '10kb' }));

async function bootstrap() {
  const privateKeyPem = loadPrivateKeyPem();
  const publicKeyPem = createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' }).toString();
  const tokenService = await TokenService.create(privateKeyPem, env.AUTH_TOKEN_TTL_SECONDS);

  if (env.AUTH_DEV_LOGIN) {
    logger.warn('AUTH_DEV_LOGIN is ENABLED: anyone who can reach this service can mint a token for any seeded identity. Never enable in production.');
  }

  app.use(
    '/api/v1',
    createAuthGateway({
      tokenService,
      publicKeyPem,
      devLoginEnabled: env.AUTH_DEV_LOGIN,
      sessionRateLimit: env.AUTH_SESSION_RATE_LIMIT,
    }),
  );

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    logger.error('Unhandled auth HTTP request error', undefined, {
      method: req.method,
      route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
      statusCode: 500,
      ...safeErrorMetadata(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(env.PORT, '0.0.0.0', () => logger.info(`Auth Server running on port ${env.PORT}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (env.NODE_ENV !== 'test') {
  await bootstrap();
}

export default app;
