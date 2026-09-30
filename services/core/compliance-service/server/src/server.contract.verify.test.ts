// File: services/core/compliance-service/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import { Server } from 'http';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { vi, describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';

import app from './server.js';

describe('Compliance Service Provider Verification', () => {
  let server: Server;
  const PORT = 8092;

  beforeAll(() => {
    server = app.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates the expectations of compliance-client', async () => {
    const opts = {
      providerBaseUrl: `http://localhost:${PORT}`,
      provider: 'compliance-server',
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/compliance-client-compliance-server.json'),
      ],
      requestFilter: (req: Request, _res: Response, next: NextFunction) => {
        if (req.url.startsWith('/compliance/')) {
          req.url = req.url.replace(/^\/compliance/, '');
        }
        next();
      },
      stateHandlers: {
        'compliance templates exist in the registry': async () => {
          // Template manifest served from registry
        },
        'template contract-test-bare exists': async () => {
          // Template HTML file exists
        },
      },
    };

    const verifier = new Verifier(opts);
    const result = await verifier.verifyProvider();
    expect(result).toBeTruthy();
  });
});