// File: services/core/compliance-service/client/src/api/documents.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';
import { DocumentSchema, signDocumentApiRequestSchema, documentsRoutes } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';

const { like, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'compliance-client',
  provider: 'compliance-server',
  cors: true,
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Compliance Client -> Compliance Server Contract (Documents API)', () => {
  const documentId = '123e4567-e89b-12d3-a456-426614174000';
  const PACT_SEED = 1;
  const exampleDocument = () => mockFromSchema(DocumentSchema, {}, { seed: PACT_SEED });

  it('returns a list of compliance documents successfully', async () => {
    const example = exampleDocument();

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
        body: arrayContaining(like(example)),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getDocuments({
        overrideClientOptions: { baseUrl: `${mockServer.url}/compliance/api/v1` },
      });

      expect(response.status).toBe(200);
      expect(documentsRoutes.getDocuments.responses[200].parse(response.body)).toHaveLength(1);
    });
  });

  it('returns a full document DTO by ID', async () => {
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
        body: like(exampleDocument()),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getDocumentById({
        params: { id: documentId },
        overrideClientOptions: { baseUrl: `${mockServer.url}/compliance/api/v1` },
      });

      expect(response.status).toBe(200);
      expect(DocumentSchema.parse(response.body)).toBeDefined();
    });
  });

  it('signs a document and returns the presignedUrl', async () => {
    const request = mockFromSchema(signDocumentApiRequestSchema, {
      documentId,
      fileHash: SHA256_HEX,
      signerId: 'usr_1',
      documentName: 'asset-transfer-authorization',
      documentType: 'AUTHORIZATION',
    }, { seed: PACT_SEED });
    const presignedUrl = 'http://localhost:9000/dsap/test.pdf?signature=123';

    provider
      .given('esign service is available for signing')
      .uponReceiving('a request to sign a document')
      .withRequest({
        method: 'POST',
        path: '/compliance/api/v1/documents/sign',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: like(request),
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: like({ presignedUrl }),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.signDocument({
        body: request,
        overrideClientOptions: { baseUrl: `${mockServer.url}/compliance/api/v1` },
      });

      expect(response.status).toBe(200);
      expect(documentsRoutes.signDocument.responses[200].parse(response.body)).toEqual({ presignedUrl });
    });
  });
});
