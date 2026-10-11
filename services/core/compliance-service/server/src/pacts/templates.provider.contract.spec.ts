// File: services/core/compliance-service/server/src/pacts/templates.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createComplianceGateway } from '../routes';

// ✅ Must match the exact import path used in templates.route.ts: '../../repositories'
vi.mock('../repositories', () => {
  return {
    TemplateRepository: {
      findAllManifests: (query?: { type?: string }) => {
        return [
          {
            id: 't-123',
            name: 'Asset Transfer Authorization',
            type: query?.type || 'AUTHORIZATION',
          },
        ];
      },
      findById: (id: string) => {
        if (id === 't-123') {
          return {
            id: 't-123',
            name: 'Asset Transfer Authorization',
            type: 'AUTHORIZATION',
            version: 1, // ✅ Satisfy client consumer contract expectation
            rawHTML: '<div>Authorization Form HTML</div>',
          };
        }
        return null;
      },
    },
  };
});

describe('Pact Provider Verification - Compliance Server (Templates)', () => {
  let server: Server;
  const PORT = 8089;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const gateway = createComplianceGateway();

    app.use('/compliance/api/v1', gateway);
    app.use('/api/v1', gateway);

    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('validates provider implementation against generated consumer pacts', async () => {
    const verifier = new Verifier({
      provider: 'compliance-server',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactUrls: [
        path.resolve(process.cwd(), '../shared/pacts/compliance-client-compliance-server.json'),
      ],
      requestFilter: (req, _res, next) => {
        if (req.url && req.url.startsWith('/compliance/')) {
          req.url = req.url.replace(/^\/compliance/, '');
        }
        next();
      },
      stateHandlers: {
        'templates exist in the system': async () => {},
        'template with ID t-123 exists': async () => {},
      },
    });

    const result = await verifier.verifyProvider();
    expect(result).toBeTruthy();
  });
});