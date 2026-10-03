// File: services/core/compliance-service/client/src/api/documents/documents.contract.test.ts
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import { fetchDocuments } from './documents';
import { setApiBaseUrl } from '../client-config';

const { like, eachLike, regex } = MatchersV3;

const runConsumerContractTest = createPactTestHelper({
  consumer: 'compliance-client',
  provider: 'compliance-server',
});

describe('Documents API Consumer Contract', () => {
  it('generates valid contract for fetching compliance documents dataset', async () => {
    await runConsumerContractTest(
      (provider) => {
        provider
          .given('compliance documents exist in the database')
          .uponReceiving('a GET request for compliance documents')
          .withRequest({
            method: 'GET',
            path: '/compliance/api/v1/documents/',
          })
          .willRespondWith({
            status: 200,
            headers: {
              'Content-Type': regex(
                'application/json.*',
                'application/json; charset=utf-8'
              ),
            },
            body: eachLike({
              id: like('123e4567-e89b-12d3-a456-426614174000'),
              document_type: like('DD-1149'),
              s3_uri: like('s3://compliance-vault/2026/dd1149.pdf'),
              status: like('Approved'),
              created_at: like('2026-09-15T14:32:00Z'),
            }),
          });
      },
      async (provider) => {
        setApiBaseUrl(provider.url);

        const documents = await fetchDocuments();

        expect(documents.length).toBeGreaterThan(0);
        expect(documents[0]).toEqual(
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174000',
            document_type: 'DD-1149',
            s3_uri: 's3://compliance-vault/2026/dd1149.pdf',
            status: 'Approved',
            created_at: '2026-09-15T14:32:00Z',
          })
        );
      }
    );
  });
});