// File: services/platform/auth-service/server/src/pacts/auth.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import type { Server } from 'node:http';
import path from 'node:path';
import { createAuthGateway } from '../routes';
import { TokenService } from '../services/token.service';

describe('Pact Provider Verification - Auth Server', () => {
  let server: Server;
  let devLoginEnabled = true;
  const PORT = 8091;

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
    const tokenService = await TokenService.create(privateKey, 900);

    const app = express();
    app.use(express.json());
    const gateway = (req: express.Request, res: express.Response, next: express.NextFunction) =>
      createAuthGateway({ tokenService, publicKeyPem, devLoginEnabled, sessionRateLimit: 1000 })(req, res, next);
    app.use('/auth/api/v1', gateway);

    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('validates provider implementation against generated consumer pacts', async () => {
    const verifier = new Verifier({
      provider: 'auth-server',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactUrls: [path.resolve(process.cwd(), '../shared/pacts/auth-client-auth-server.json')],
      stateHandlers: {
        'dev login is enabled': async () => {
          devLoginEnabled = true;
        },
      },
    });

    await verifier.verifyProvider();
  });
});
