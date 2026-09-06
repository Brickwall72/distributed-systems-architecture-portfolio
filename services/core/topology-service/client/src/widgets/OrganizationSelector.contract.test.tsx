// File: services/core/topology-service/client/src/widgets/OrganizationSelector.contract.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { vi } from 'vitest';
import OrganizationSelector from './OrganizationSelector';

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('OrganizationSelector Consumer Contract', () => {
  it('generates a valid contract for fetching organizations', async () => {
    provider
      .given('organizations exist in the topology graph')
      .uponReceiving('a GET request for organization entities')
      .withRequest({
        method: 'GET',
        path: '/api/v1/topology/organizations', // Ensure this matches your actual backend route
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: eachLike({
          id: like('org-1111-lockheed'),
          name: like('Lockheed Martin Space'),
          type: like('CONTRACTOR'),
          address1: like('1111 Lockheed Martin Way'),
          // address2 is omitted here assuming it might be optional, 
          // or add `address2: like('Sunnyvale, CA 94089')` if it's strictly required
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
          <OrganizationSelector 
            label="Select Organization (Contract)" 
            onChange={handleChange} 
          />
        );

        // Wait for the mock data to populate the combobox/dropdown
        await waitFor(() => {
          expect(screen.getByRole('combobox')).toBeInTheDocument();
        }, { timeout: 5000 });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});