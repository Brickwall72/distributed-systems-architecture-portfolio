// File: services/core/compliance-service/client/src/widgets/TemplateSelector.contract.test.tsx
import { render, waitFor } from '@testing-library/react';
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import TemplateSelector from './TemplateSelector';

const { like, eachLike, regex } = MatchersV3;
const runConsumerContractTest = createPactTestHelper({consumer:'compliance-client', provider:'compliance-server'})

describe('TemplateSelector Consumer Contract', () => {
  it('generates valid contracts for fetching the manifest and individual templates', async () => {
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
            headers: { 'Content-Type': regex('application/json.*', 'application/json; charset=utf-8') },
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
            headers: { 'Content-Type': regex('text/html.*', 'text/html; charset=utf-8') },
            body: '<!DOCTYPE html><html><body><h1>Minimal Contract Template</h1></body></html>',
          });
      },
      async () => {
        const handleTemplateLoad = vi.fn();

        render(
          <TemplateSelector 
            label="Select Form (Contract)" 
            onTemplateLoad={handleTemplateLoad} 
          />
        );

        await waitFor(() => {
          expect(handleTemplateLoad).toHaveBeenCalledWith(
            'contract-test-bare', 
            expect.any(String)
          );
        }, { timeout: 5000 });
      }
    );
  });
});