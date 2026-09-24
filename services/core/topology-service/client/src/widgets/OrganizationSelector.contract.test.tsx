// File: services/core/topology-service/client/src/widgets/OrganizationSelector.contract.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import OrganizationSelector from './OrganizationSelector';

const { like, eachLike } = MatchersV3;
const runConsumerContractTest = createPactTestHelper({consumer:'topology-client', provider:'topology-server'})

describe('OrganizationSelector Consumer Contract', () => {
  it('generates a valid contract for fetching organizations', async () => {
    await runConsumerContractTest(
      (provider) => {
        provider
          .given('organizations exist in the topology graph')
          .uponReceiving('a GET request for organization entities')
          .withRequest({
            method: 'GET',
            path: '/topology/api/v1/organizations',
          })
          .willRespondWith({
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: eachLike({
              id: like('org-uuid-101'),
              name: like('Lockheed Martin Space'),
              type: like('CONTRACTOR'),
            }),
          });
      },
      async () => {
        const handleChange = vi.fn();

        render(
          <OrganizationSelector 
            label="Select Organization (Contract)" 
            onChange={handleChange} 
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('combobox')).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    );
  });
});