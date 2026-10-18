// File: services/core/compliance-service/client/src/api/documents.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';

const { like, string, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'compliance-client',
  provider: 'compliance-server',
  cors: true,
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Compliance Client -> Compliance Server Contract (Documents API)', () => {
  it('returns a list of compliance documents successfully', async () => {
    provider
      .given('compliance documents exist in the database')
      .uponReceiving('a request to get all compliance documents')
      .withRequest({
        method: 'GET',
        path: '/compliance/api/v1/documents',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: arrayContaining(
          like({
            id: string('123e4567-e89b-12d3-a456-426614174000'),
            documentType: string('asset-transfer-authorization'),
            storageBucket: string('compliance-vault'),
            storageKey: string('2026/dd1149.pdf'),
            status: string('SIGNED'),
            createdAt: string('2026-09-15T14:32:00.000Z'),
            updatedAt: string('2026-09-15T14:32:00.000Z'),
          })
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getDocuments({
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as Array<{ id: string; documentType: string; storageBucket: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(body[0].documentType).toBe('asset-transfer-authorization');
    });
  });

  it('returns a full document DTO by ID', async () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174000';

    provider
      .given(`document with ID ${documentId} exists`)
      .uponReceiving(`a request to get document ${documentId}`)
      .withRequest({
        method: 'GET',
        path: `/compliance/api/v1/documents/${documentId}`,
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: like({
          id: string(documentId),
          documentType: string('asset-transfer-authorization'),
          storageBucket: string('compliance-vault'),
          storageKey: string('2026/dd1149.pdf'),
          status: string('SIGNED'),
          createdAt: string('2026-09-15T14:32:00.000Z'),
          updatedAt: string('2026-09-15T14:32:00.000Z'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getDocumentById({
        params: { id: documentId },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as { id: string; documentType: string; storageBucket: string };
      expect(body.id).toBe(documentId);
      expect(body.documentType).toBe('asset-transfer-authorization');
    });
  });
});