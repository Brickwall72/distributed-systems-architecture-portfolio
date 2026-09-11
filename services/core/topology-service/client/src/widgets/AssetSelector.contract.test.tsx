// File: services/core/topology-service/client/src/widgets/AssetSelector.contract.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import AssetSelector from './AssetSelector';

const { like, eachLike } = MatchersV3;
const runConsumerContractTest = createPactTestHelper({consumer:'topology-client', provider:'topology-server'})

describe('AssetSelector Consumer Contract', () => {
  it('generates a valid contract for fetching assets', async () => {
    await runConsumerContractTest(
      (provider) => {
        provider
          .given('assets exist in the topology graph')
          .uponReceiving('a GET request for asset entities')
          .withRequest({
            method: 'GET',
            path: '/api/v1/topology/assets',
          })
          .willRespondWith({
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: eachLike({
              id: like('asset-uuid-001'),
              nomenclature: like('Primary Substation Alpha'),
              serialNumber: like('SN-12345'),
              currentOwnerId: like('org-uuid-101'),
            }),
          });
      },
      async () => {
        const handleChange = vi.fn();

        render(
          <AssetSelector 
            label="Select Asset (Contract)" 
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