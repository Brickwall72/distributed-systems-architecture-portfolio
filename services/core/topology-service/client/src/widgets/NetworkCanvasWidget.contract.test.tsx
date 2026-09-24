// File: services/core/topology-service/client/src/widgets/NetworkCanvasWidget.contract.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { vi } from 'vitest';
import NetworkCanvasWidget from './NetworkCanvasWidget';

// Fix: Use a standard function constructor for vis.Network
vi.mock('vis-network', () => ({
  Network: vi.fn(function () {
    return {
      destroy: vi.fn(),
    };
  }),
}));

// Fix: Use a standard function constructor for vis-data DataSet
vi.mock('vis-data', () => ({
  DataSet: vi.fn(function (data) {
    return data;
  }),
}));

const { like } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('NetworkCanvasWidget Consumer Contract', () => {
  it('generates a valid contract for fetching the entity directory graph', async () => {
    provider
      .given('topology entities and custody transfers exist')
      .uponReceiving('a request for the full entity directory graph')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/entities',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          transfers: [
            {
              senderOrgId: like('org-101'),
              senderName: like('Lockheed Martin Space'),
              receiverOrgId: like('org-102'),
              receiverName: like('Space Systems Command'),
              assetId: like('asset-001'),
              assetNomenclature: like('Primary Substation Alpha'),
              serialNumber: like('SN-12345'),
              requisitionNumber: like('DD1149-9988'),
              transferDate: like('2026-09-06'),
            },
          ],
        },
      });

    await provider.executeTest(async (mockServer) => {
      const originalFetch = global.fetch;

      // Route fetch calls to the Pact mock server
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = typeof input === 'string' ? input : input.toString();
        const targetUrl = urlString.startsWith('/')
          ? `${mockServer.url}${urlString}`
          : urlString;

        return originalFetch(targetUrl, init);
      };

      try {
        render(<NetworkCanvasWidget />);

        // 1. Verify loading state appears initially
        expect(screen.getByText(/Traversing Space Custody Network Threads/i)).toBeInTheDocument();

        // 2. Wait for the fetch to resolve, removing the loading banner
        await waitFor(() => {
          expect(screen.queryByText(/Traversing Space Custody Network Threads/i)).not.toBeInTheDocument();
        });

        // 3. Verify no error boundaries were tripped
        expect(screen.queryByText(/Failed to aggregate live topology layers/i)).not.toBeInTheDocument();

      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});