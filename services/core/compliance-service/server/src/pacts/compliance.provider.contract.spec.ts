// File: services/core/compliance-service/server/src/pacts/compliance.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createComplianceGateway } from '../routes';

vi.mock('../repositories', () => {
  return {
    ComplianceDocumentRepository: class {
      async findAll() {
        return [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            documentType: 'asset-transfer-authorization',
            storageBucket: 'compliance-vault',
            storageKey: '2026/dd1149.pdf',
            status: 'SIGNED',
            signerId: 'usr_1',
            entityId: 'org_1',
            fileHash: 'a'.repeat(64),
            createdAt: '2026-09-15T14:32:00.000Z',
            updatedAt: '2026-09-15T14:32:00.000Z',
          },
        ];
      }
      async findById(id: string) {
        return {
          id,
          documentType: 'asset-transfer-authorization',
          storageBucket: 'dsap',
          storageKey: `${id}.pdf`,
          status: 'SIGNED',
          signerId: 'usr_1',
          entityId: 'org_1',
          fileHash: 'a'.repeat(64),
          createdAt: '2026-09-15T14:32:00.000Z',
          updatedAt: '2026-09-15T14:32:00.000Z',
        };
      }
      async upsert() {
        return Promise.resolve();
      }
    },
    TemplateRepository: {
      findAllManifests: (query?: { type?: string }) => [
        {
          id: 't-123',
          name: 'Asset Transfer Authorization',
          type: query?.type || 'AUTHORIZATION',
        },
      ],
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

describe('Pact Provider Verification - Compliance Server (Unified)', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const nowIso = '2026-10-17T00:00:00.000Z';
    const mockBroker = {
      request: vi.fn().mockResolvedValue({
        success: true,
        id: '123e4567-e89b-12d3-a456-426614174000',
        documentType: 'asset-transfer-authorization',
        signerId: 'usr_1',
        entityId: 'org_1',
        status: 'SIGNED',
        s3Uri: 's3://dsap/test.pdf',
        storageBucket: 'dsap',
        storageKey: 'test.pdf',
        fileHash: 'a'.repeat(64),
        signedAt: nowIso,
        uploadedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        presignedUrl: 'http://localhost:9000/dsap/test.pdf?signature=xyz',
        correlationId: 'test-corr-123',
      }),
    };

    const gateway = createComplianceGateway({ broker: mockBroker as any });

    app.use('/compliance/api/v1', gateway);
    app.use('/api/v1', gateway);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  }, 20000);

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
      providerBaseUrl: `http://localhost:${port}`,
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
        'compliance documents exist in the database': async () => {},
        'document with ID 123e4567-e89b-12d3-a456-426614174000 exists': async () => {},
        'esign service is available for signing': async () => {},
      },
    });

    const result = await verifier.verifyProvider();
    expect(result).toBeTruthy();
  }, 30000);
});