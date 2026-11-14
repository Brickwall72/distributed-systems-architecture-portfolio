// File: services/core/compliance-service/server/src/pacts/compliance.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createComplianceGateway } from '../routes';
import { EventBroker } from '@shared/messaging';
import { DocumentsRepository, draftBindingSchema, SigningOperationsRepository } from '../repositories';
import type { Pool } from 'pg';
import { PDF_SUBJECTS, generatePdfResponseSchema } from '@contracts/pdf';
import { SignDocumentResponseSchema } from '@contracts/esign';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { TopologyNatsClient } from '../messaging';
import { transferDraftFactsSchema } from '@contracts/topology';

const pactRequest = vi.hoisted(() => ({ body: {} as unknown }));

vi.mock('../db', () => ({ pool: {} }));

vi.mock('../repositories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../repositories')>();
  const { mockFromSchema, SHA256_HEX } = await import('@shared/testing');
  // Same seed as the consumer specs so optional keys line up with the committed pact examples.
  const seed = { seed: 1 };
  const { templateDTOSchema, templateManifestSchema } = await import('compliance-shared');

  // Resolved lazily: '../domain' imports '../repositories', which is mid-mock while this factory runs.
  const entity = async (overrides = {}) => {
    const { documentEntitySchema } = await import('../domain');
    return mockFromSchema(documentEntitySchema, { fileHash: SHA256_HEX, signerId: 'usr_1', ...overrides }, seed);
  };

  return {
    ...actual,
    DocumentsRepository: class {
      findAll = () => entity().then((doc) => [doc]);
      findById = (id: string) => entity({ id });
      insert = () => entity({ type: 'AUTHORIZATION', name: 'asset-transfer-authorization' });
      saveDraftBinding = async () => {};
      findDraftBinding = async () => draftBindingSchema.parse(pactRequest.body);
    },
    TemplateRepository: {
      findAllManifests: () => [
        mockFromSchema(templateManifestSchema, { name: 'Asset Transfer Authorization' }, seed),
      ],
      findById: (id: string) =>
        id === 'asset-transfer-authorization'
          ? mockFromSchema(templateDTOSchema, {
              id,
              name: 'Asset Transfer Authorization',
              type: 'AUTHORIZATION',
              rawHTML: '<div>Authorization Form HTML</div>',
            }, seed)
          : null,
    },
  };
});

describe('Pact Provider Verification - Compliance Server (Unified)', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.identity = {
        sub: 'pact-member',
        orgId: req.path.endsWith('/documents/sign') && typeof req.body?.senderOrgId === 'string'
          ? req.body.senderOrgId : 'org-1',
        roles: ['org-member'],
        signerId: 'pact-member',
      };
      pactRequest.body = req.body;
      next();
    });

    const mockBroker = new EventBroker('nats://provider-test');
    mockBroker.request = vi.fn((subject: string) => {
        if (subject === PDF_SUBJECTS.GENERATE_PDF) {
          return Promise.resolve(
            mockFromSchema(generatePdfResponseSchema, { success: true, fileHash: SHA256_HEX }, { seed: 1 }),
          );
        }
        return Promise.resolve(
          mockFromSchema(SignDocumentResponseSchema, { success: true, fileHash: SHA256_HEX }, { seed: 1 }),
        );
      }) as typeof mockBroker.request;
    const repository = new DocumentsRepository({} as Pool);
    const topology = new TopologyNatsClient(mockBroker);
    topology.validateDraft = vi.fn().mockResolvedValue(mockFromSchema(transferDraftFactsSchema));
    const signingOperations = new SigningOperationsRepository({} as Pool);
    signingOperations.enqueue = vi.fn().mockResolvedValue({});
    signingOperations.find = vi.fn().mockResolvedValue({ state: 'COMPLETED' });
    const signingCoordinator = { processNext: vi.fn().mockResolvedValue(true) };

    const gateway = createComplianceGateway({
      broker: mockBroker,
      repository,
      topology,
      signingOperations,
      signingCoordinator,
      getSignedDownloadUrl: async () => 'http://localhost:9000/dsap/test.pdf?signature=xyz',
    });

    app.use('/compliance/api/v1', gateway);
    app.use('/api/v1', gateway);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as AddressInfo).port;
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