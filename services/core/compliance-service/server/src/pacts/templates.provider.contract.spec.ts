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
    const app = express();
    app.use(express.json());

    const mockBroker = {
      request: vi.fn().mockResolvedValue({
        success: true,
        documentId: '3ef7a5e5-72d3-47df-a5d6-f3e871e34df9', // ✅ Must be a valid UUID
        s3Uri: 's3://drafts/org-1/transfers/asset-transfer-authorization/REQ-2026-0001.pdf',
        storageBucket: 'drafts',
        storageKey: 'org-1/transfers/asset-transfer-authorization/REQ-2026-0001.pdf',
        presignedUrl: 'http://localhost:9000/dsap/test-document.pdf?signature=xyz',
        fileHash: 'sha256fakehash',
        correlationId: 'test-corr-123',
      }),
    };

    const gateway = createComplianceGateway({ broker: mockBroker as any });

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
        'template with ID asset-transfer-authorization exists': async () => {},
        'template with ID asset-transfer-authorization exists for drafting': async () => {},
      },
    });

    const result = await verifier.verifyProvider();
    expect(result).toBeTruthy();
  });
});