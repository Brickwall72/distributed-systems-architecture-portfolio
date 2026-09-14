// File: services/core/compliance-service/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import { Server } from 'http';
import path from 'path';

// Hoist mock functions to intercept database and storage during verification
const { mockPoolQuery } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn().mockResolvedValue({
    rows: [{ id: 42, created_at: '2026-09-12T19:00:00.000Z' }],
  }),
}));

const { mockUploadComplianceDocument } = vi.hoisted(() => ({
  mockUploadComplianceDocument: vi.fn().mockResolvedValue(
    's3://compliance-documents/transfer-approval/test-doc-123.pdf'
  ),
}));

vi.mock('./db/database.js', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  pool: {
    query: mockPoolQuery,
  },
}));

vi.mock('./services/storage.js', () => ({
  uploadComplianceDocument: mockUploadComplianceDocument,
}));

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

  it('validates the expectations of compliance-client', async () => {
    const opts = {
      providerBaseUrl: `http://localhost:${PORT}`,
      provider: 'compliance-server',
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/compliance-client-compliance-server.json')
      ],
      stateHandlers: {
        'compliance templates exist in the registry': async () => {
          console.log('Templates are ready');
        },
        'template contract-test-bare exists': async () => {
          console.log('contract-test-bare is ready');
        },
        'compliance document backend is ready to accept saves': async () => {
          mockPoolQuery.mockResolvedValue({
            rows: [{ id: 42, created_at: '2026-09-12T19:00:00.000Z' }],
          });
          mockUploadComplianceDocument.mockResolvedValue(
            's3://compliance-documents/transfer-approval/test-doc-123.pdf'
          );
        },
        'compliance documents exist': async () => {
          mockPoolQuery.mockResolvedValue({
            rows: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                document_ref: 'DD1149-asset-transfer.pdf',
                s3_uri: 's3/uri/location/pdf.pdf',
                status: 'Pending',
                created_at: '2026-09-13T21:00:20.000Z',
              },
            ],
          });
        },
      }
    };

    const verifier = new Verifier(opts);
    await verifier.verifyProvider();
  });
});