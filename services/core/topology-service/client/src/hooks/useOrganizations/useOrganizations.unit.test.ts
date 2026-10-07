// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useOrganizations } from './useOrganizations';
import { apiClient } from '../../api';
import type { OrganizationDTOList } from 'topology-shared';

// Mock the API client to intercept HTTP calls at the boundary
vi.mock('../../api/client', () => ({
  apiClient: {
    getOrganizations: vi.fn(),
  },
}));

describe('useOrganizations (Hook Unit Test)', () => {
  const mockOrganizations: OrganizationDTOList = [
    {
      id: 'org-101',
      name: 'Space Systems Command',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Building 2730',
      addressLine2: 'El Segundo, CA',
    },
    {
      id: 'org-102',
      name: 'General Dynamics',
      type: 'CONTRACTOR',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading state and resolves data on successful fetch', async () => {
    vi.mocked(apiClient.getOrganizations).mockResolvedValue({
      status: 200,
      body: mockOrganizations,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useOrganizations());

    // 1. Initial State assertions
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();

    // 2. Wait for async resolution
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockOrganizations);
    expect(result.current.error).toBeNull();
    expect(apiClient.getOrganizations).toHaveBeenCalledTimes(1);
  });

  it('handles custom fetch parameters correctly (filterOwnedId)', async () => {
    vi.mocked(apiClient.getOrganizations).mockResolvedValue({
      status: 200,
      body: mockOrganizations,
      headers: new Headers(),
    });

    const queryParams = { filterOwnedId: 'asset-99' };
    const { result } = renderHook(() => useOrganizations(queryParams));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getOrganizations).toHaveBeenCalledWith({
      query: queryParams,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });

  it('sets error state when API returns non-200 status code matching ApiErrorResponseSchema', async () => {
    vi.mocked(apiClient.getOrganizations).mockResolvedValue({
      status: 500,
      body: {
        error: 'Database connection failed',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      },
      headers: new Headers(),
    });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Database connection failed');
  });

  it('uses default fallback error message when exception message is absent', async () => {
    vi.mocked(apiClient.getOrganizations).mockRejectedValue(new Error(''));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch organizations');
  });

  it('re-fetches organizations when filter parameters change', async () => {
    vi.mocked(apiClient.getOrganizations).mockResolvedValue({
      status: 200,
      body: mockOrganizations,
      headers: new Headers(),
    });

    const { result, rerender } = renderHook((props) => useOrganizations(props), {
      initialProps: { filterOwnedId: 'asset-01' },
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getOrganizations).toHaveBeenLastCalledWith({
      query: { filterOwnedId: 'asset-01' },
      fetchOptions: { signal: expect.any(AbortSignal) },
    });

    // Rerender with updated query params
    rerender({ filterOwnedId: 'asset-02' });

    await waitFor(() => {
      expect(apiClient.getOrganizations).toHaveBeenCalledTimes(2);
    });

    expect(apiClient.getOrganizations).toHaveBeenLastCalledWith({
      query: { filterOwnedId: 'asset-02' },
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });

  it('prevents state updates if component unmounts before request resolves', async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(apiClient.getOrganizations).mockReturnValue(pendingPromise as any);

    const { result, unmount } = renderHook(() => useOrganizations());

    expect(result.current.isLoading).toBe(true);

    // Unmount before resolving
    unmount();

    resolvePromise!({
      status: 200,
      body: mockOrganizations,
      headers: new Headers(),
    });

    // Expect no state pollution
    expect(result.current.items).toEqual([]);
  });
});