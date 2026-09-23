// File: services/core/compliance-service/client/src/api/documents.contract.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { fetchDocuments } from './documents';
import { setApiBaseUrl } from './client-config';

const { eachLike, string, uuid, datetime, regex } = MatchersV3;

const provider = new PactV3({
  consumer: 'compliance-client',
  provider: 'compliance-server',
});

describe('Documents API Contract', () => {
  it('returns a validated array of document records', async () => {
    provider
      .given('compliance documents exist')
      .uponReceiving('a request to get the documents dataset')
      .withRequest({
        method: 'GET',
        path: '/compliance/api/v1/documents/',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: eachLike({
          id: uuid('550e8400-e29b-41d4-a716-446655440000'),
          document_type: string('DD1149-asset-transfer.pdf'),
          // regex ensures the backend generates one of the allowed enum values
          s3_uri: string('s3/uri/location/pdf.pdf'),
          status: regex('^(Pending|Approved|Rejected)$', 'Pending'), 
          created_at: datetime("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", '2026-09-13T21:00:20.000Z'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      // Configure the mock server URL globally for the client
      setApiBaseUrl(mockServer.url);
      
      // Call fetcher cleanly with zero arguments
      const documents = await fetchDocuments();
      
      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0].document_type).toBeDefined();
    });
  });
});