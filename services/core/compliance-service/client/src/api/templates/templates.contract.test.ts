// File: services/core/compliance-service/client/src/api/templates/templates.contract.test.ts
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import { fetchTemplateManifest, fetchTemplateContent } from './templates';
import { setApiBaseUrl } from '../client-config';

const { like, eachLike, regex } = MatchersV3;

const runConsumerContractTest = createPactTestHelper({
  consumer: 'compliance-client',
  provider: 'compliance-server',
});

describe('Templates API Consumer Contract', () => {
  it('generates valid contracts for fetching manifest and template markup', async () => {
    await runConsumerContractTest(
      (provider) => {
        provider
          .given('compliance templates exist in the registry')
          .uponReceiving('a GET request for template manifest')
          .withRequest({
            method: 'GET',
            path: '/compliance/api/v1/templates',
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
              id: like('contract-test-bare'),
              name: like('Minimal Test Template'),
            }),
          });

        provider
          .given('template contract-test-bare exists')
          .uponReceiving('a GET request for template html content')
          .withRequest({
            method: 'GET',
            path: '/compliance/api/v1/templates/contract-test-bare',
          })
          .willRespondWith({
            status: 200,
            headers: {
              'Content-Type': regex(
                'text/html.*',
                'text/html; charset=utf-8'
              ),
            },
            body: '<!DOCTYPE html><html><body><h1>Minimal Contract Template</h1></body></html>',
          });
      },
      async (provider) => {
        // Direct Pact provider URL routing for API execution
        setApiBaseUrl(provider.url);

        // 1. Test manifest fetch and Zod runtime schema validation
        const manifest = await fetchTemplateManifest();
        expect(manifest).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'contract-test-bare',
              name: 'Minimal Test Template',
            }),
          ])
        );

        // 2. Test raw HTML content retrieval
        const htmlContent = await fetchTemplateContent('contract-test-bare');
        expect(htmlContent).toContain('<h1>Minimal Contract Template</h1>');
      }
    );
  });
});