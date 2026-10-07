// File: services/core/topology-service/client/src/hooks/useAssets/useAssets.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAssets } from '../useAssets';
import { apiClient } from '../../api/client';
import type { AssetDTO } from 'topology-shared';

// Mock the API client to intercept HTTP calls at the boundary
vi.mock('../../api/client', () => ({
  apiClient: {
    getAssets: vi.fn(),
  },
}));

describe('useAssets (Hook Unit Test)', () => {
  const mockAssets: AssetDTO[] = [
    {
      id: 'ast-101',
      name: 'Radio Transceiver',
      nomenclature: 'Radio Transceiver',
      serialNumber: 'SN-001',
      currentOwnerId: 'org-1',
    },
    {
      id: 'ast-102',
      name: 'Satellite Terminal',
      nomenclature: 'Satellite Terminal',
      serialNumber: 'SN-002',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading state and resolves data on successful fetch', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 200,
      body: mockAssets,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useAssets());

    // 1. Initial State assertions
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();

    // 2. Wait for async resolution
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockAssets);
    expect(result.current.error).toBeNull();
    expect(apiClient.getAssets).toHaveBeenCalledTimes(1);
  });

  it('handles custom fetch parameters correctly (filterOwnerId and excludeOwnerId)', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 200,
      body: mockAssets,
      headers: new Headers(),
    });

    const queryParams = { filterOwnerId: 'org-1', excludeOwnerId: 'org-2' };
    const { result } = renderHook(() => useAssets(queryParams));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getAssets).toHaveBeenCalledWith({
      query: queryParams,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });

  it('sets error state when API returns non-200 status code', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 500,
      body: { error: 'Database connection failed' },
      headers: new Headers(),
    });

    const { result } = renderHook(() => useAssets());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Database connection failed');
  });

  it('uses default fallback error message when exception message is absent', async () => {
    vi.mocked(apiClient.getAssets).mockRejectedValue(new Error(''));

    const { result } = renderHook(() => useAssets());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Failed to load assets');
  });

  it('re-fetches assets when owner filter parameters change', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 200,
      body: mockAssets,
      headers: new Headers(),
    });

    const { result, rerender } = renderHook((props) => useAssets(props), {
      initialProps: { filterOwnerId: 'org-1' },
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getAssets).toHaveBeenLastCalledWith({
      query: { filterOwnerId: 'org-1', excludeOwnerId: undefined },
      fetchOptions: { signal: expect.any(AbortSignal) },
    });

    // Rerender with updated query params
    rerender({ filterOwnerId: 'org-2' });

    await waitFor(() => {
      expect(apiClient.getAssets).toHaveBeenCalledTimes(2);
    });

    expect(apiClient.getAssets).toHaveBeenLastCalledWith({
      query: { filterOwnerId: 'org-2', excludeOwnerId: undefined },
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });

  it('prevents state updates if component unmounts before request resolves', async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(apiClient.getAssets).mockReturnValue(pendingPromise as any);

    const { result, unmount } = renderHook(() => useAssets());

    expect(result.current.isLoading).toBe(true);

    // Unmount before resolving the promise
    unmount();

    // Resolve after unmount
    resolvePromise!({
      status: 200,
      body: mockAssets,
      headers: new Headers(),
    });

    // Expect no state pollution or memory leak warnings
    expect(result.current.items).toEqual([]);
  });
});