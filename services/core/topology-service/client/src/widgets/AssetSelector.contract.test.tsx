// File: services/core/topology-service/client/src/widgets/AssetSelector.contract.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import AssetSelector from './AssetSelector';

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('AssetSelector Consumer Contract', () => {
  it('generates a valid contract for fetching assets', async () => {
    // Only define the interaction that actually occurs
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

    await provider.executeTest(async (mockServer) => {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = typeof input === 'string' ? input : input.toString();
        const targetUrl = urlString.startsWith('/') 
          ? `${mockServer.url}${urlString}` 
          : urlString;
          
        return originalFetch(targetUrl, init);
      };

      try {
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
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});