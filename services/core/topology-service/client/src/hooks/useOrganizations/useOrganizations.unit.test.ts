// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrganizations } from './useOrganizations';
import { fetchOrganizations } from '../../api';

vi.mock('../../api', () => ({
  fetchOrganizations: vi.fn(),
}));

describe('useOrganizations (Hook)', () => {
  const mockFetchOrganizations = vi.mocked(fetchOrganizations);

  const mockOrganizations = [
    {
      id: 'org-101',
      name: '1st Battalion',
      code: '1BN',
      addressLine1: '101 Cyber Way',
    },
    {
      id: 'org-102',
      name: '2nd Battalion',
      code: '2BN',
      addressLine1: '102 Cyber Way',
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with loading state and resolves data on successful fetch', async () => {
    mockFetchOrganizations.mockResolvedValueOnce(mockOrganizations);

    const { result } = renderHook(() => useOrganizations());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockOrganizations);
    expect(result.current.error).toBeNull();
    expect(mockFetchOrganizations).toHaveBeenCalledTimes(1);
    expect(mockFetchOrganizations).toHaveBeenCalledWith({
      parentId: undefined,
      excludeId: undefined,
    });
  });

  it('handles custom parentId and excludeId parameters correctly', async () => {
    mockFetchOrganizations.mockResolvedValueOnce(mockOrganizations);

    const params = { parentId: 'org-parent-1', excludeId: 'org-101' };
    const { result } = renderHook(() => useOrganizations(params));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchOrganizations).toHaveBeenCalledWith({
      parentId: 'org-parent-1',
      excludeId: 'org-101',
    });
  });

  it('sets error state when fetchOrganizations fails', async () => {
    mockFetchOrganizations.mockRejectedValueOnce(new Error('Database query failed'));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Database query failed');
  });

  it('uses default fallback error message when error object lacks message', async () => {
    mockFetchOrganizations.mockRejectedValueOnce({});

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load organizations');
  });

  it('re-fetches organizations when parentId or excludeId parameters change', async () => {
    mockFetchOrganizations.mockResolvedValue(mockOrganizations);

    const { result, rerender } = renderHook(
      (params: { parentId?: string; excludeId?: string }) => useOrganizations(params),
      {
        initialProps: { parentId: 'org-parent-1', excludeId: undefined } as {
          parentId?: string;
          excludeId?: string;
        },
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchOrganizations).toHaveBeenCalledWith({
      parentId: 'org-parent-1',
      excludeId: undefined,
    });

    rerender({ parentId: 'org-parent-2', excludeId: 'org-101' });

    await waitFor(() => {
      expect(mockFetchOrganizations).toHaveBeenCalledWith({
        parentId: 'org-parent-2',
        excludeId: 'org-101',
      });
    });

    expect(mockFetchOrganizations).toHaveBeenCalledTimes(2);
  });

  it('prevents state updates if component unmounts before request resolves', async () => {
    let resolvePromise!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetchOrganizations.mockReturnValueOnce(pendingPromise as any);

    const { unmount } = renderHook(() => useOrganizations());

    unmount();

    resolvePromise(mockOrganizations);

    await expect(pendingPromise).resolves.toEqual(mockOrganizations);
  });
});