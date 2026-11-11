// File: services/core/topology-service/client/src/hooks/useGraph/useGraph.unit.test.tsx
import { setTestSession } from '@shared/testing';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useGraph } from './useGraph';
import type { GraphDTO } from 'topology-shared';

const mockGraphData: GraphDTO = {
  timestamp: new Date().toISOString(),
  organizations: [
    { id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
  ],
  assets: [
    { id: 'asset-1', name: 'Probe Mk I', nomenclature: 'Probe Mk I', serialNumber: 'KSP-01', status: 'AVAILABLE', type: 'SPACECRAFT', controlType: 'LOCAL', currentOwnerId: 'org-1' },
  ],
  transfers: [],
  custodyLinks: [{ orgId: 'org-1', assetId: 'asset-1' }],
};

const server = setupServer(
  http.get('/topology/api/v1/graph', () => {
    return HttpResponse.json(mockGraphData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useGraph Hook', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    setTestSession();
  });

  it('should successfully fetch and return graph data with loading state transitions', async () => {
    const { result } = renderHook(() => useGraph(), { wrapper: createWrapper() });

    // Initial loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.graphData).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for resolution
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.graphData).toEqual(mockGraphData);
    expect(result.current.error).toBeNull();
  });

  it('should handle non-200 API responses gracefully with fallback error messages', async () => {
    server.use(
      http.get('/topology/api/v1/graph', () => {
        return HttpResponse.json({ error: 'Database timeout' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useGraph(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.graphData).toBeNull();
    expect(result.current.error).toBe('Database timeout');
  });

  it('should catch network errors and set error state', async () => {
    server.use(
      http.get('/topology/api/v1/graph', () => {
        return new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' });
      })
    );

    const { result } = renderHook(() => useGraph(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.graphData).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('should send graph filter inputs as query parameters', async () => {
    let receivedQuery: URLSearchParams | undefined;
    server.use(
      http.get('/topology/api/v1/graph', ({ request }) => {
        receivedQuery = new URL(request.url).searchParams;
        return HttpResponse.json(mockGraphData);
      })
    );

    const { result } = renderHook(
      () => useGraph({
        whitelistSenders: ['sender-1'],
        whitelistReceivers: ['receiver-1'],
        whitelistAssets: ['asset-1'],
        whitelistTransfers: ['transfer-1'],
        includeCompletedTransferEvents: true,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Array.from(receivedQuery?.entries() ?? [])).toEqual([
      ['whitelistSenders[0]', 'sender-1'],
      ['whitelistReceivers[0]', 'receiver-1'],
      ['whitelistAssets[0]', 'asset-1'],
      ['whitelistTransfers[0]', 'transfer-1'],
      ['includeCompletedTransferEvents', 'true'],
    ]);
  });
});