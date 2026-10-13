// File: services/core/compliance-service/server/src/pacts/templates.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createComplianceGateway } from '../routes';

vi.mock('../repositories', () => {
  return {
    TemplateRepository: {
      findAllManifests: (query?: { type?: string }) => {
        return [
          {
            id: 'asset-transfer-authorization',
            name: 'Asset Transfer Authorization',
            type: query?.type || 'AUTHORIZATION',
          },
        ];
      },
      findById: (id: string) => {
        if (id === 'asset-transfer-authorization') {
          return {
            id: 'asset-transfer-authorization',
            name: 'Asset Transfer Authorization',
            type: 'AUTHORIZATION',
            version: 1,
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
    // Mock global fetch for downstream PDF service calls during verification
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('mock-pdf-binary-content'),
      })
    );

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
    vi.unstubAllGlobals();
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
        'template with ID asset-transfer-authorization exists': async () => {},
        'template with ID asset-transfer-authorization exists for drafting': async () => {},
      },
    });

    const result = await verifier.verifyProvider();
    expect(result).toBeTruthy();
  });
});