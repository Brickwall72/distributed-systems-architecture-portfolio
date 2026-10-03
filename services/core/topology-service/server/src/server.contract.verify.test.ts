// File: services/core/topology-service/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import type { Server } from 'node:http';
import { mockState } from './utils/test-setup';
import app from './server';

describe('Pact Provider Verification', () => {
  let server: Server | undefined;
  const port = 8093;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('validates expected contracts from topology-client', async () => {
    const opts = {
      provider: 'topology-server',
      providerBaseUrl: `http://127.0.0.1:${port}`,
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/topology-client-topology-server.json'),
      ],
      requestFilter: (req: Request, _res: Response, next: NextFunction) => {
        if (req.url.startsWith('/topology')) {
          req.url = req.url.replace(/^\/topology/, '');
        }
        next();
      },
      stateHandlers: {
        'assets exist for owner org-101': async () => {
          mockState.currentState = 'assets';
        },
        'organizations exist under parent org-parent-101': async () => {
          mockState.currentState = 'organizations';
        },
        'topology entities and custody transfers exist': async () => {
          mockState.currentState = 'entities';
        },
      },
    };

    const verifier = new Verifier(opts);
    await verifier.verifyProvider();
  });
});