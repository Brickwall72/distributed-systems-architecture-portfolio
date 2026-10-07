// File: services/core/topology-service/client/src/hooks/useTopologyQuery.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTopologyQuery } from './useTopologyQuery';

describe('useTopologyQuery (Base Hook Primitives)', () => {
  it('resolves items array on HTTP 200 with valid array payload', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: [{ id: '1', name: 'Test Entity' }],
    });

    const { result } = renderHook(() =>
      useTopologyQuery({
        params: { filter: 'active' },
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Fallback error',
      })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([{ id: '1', name: 'Test Entity' }]);
    expect(result.current.error).toBeNull();
  });

  it('extracts structured body.error when HTTP status is non-200', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 400,
      body: { error: 'Invalid query parameter', code: 'BAD_REQUEST' },
    });

    const { result } = renderHook(() =>
      useTopologyQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Fallback error',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Invalid query parameter');
  });

  it('uses fallback error message when error response body lacks error or message key', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 500,
      body: null,
    });

    const { result } = renderHook(() =>
      useTopologyQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Custom Service Fallback',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Custom Service Fallback');
  });

  it('silently swallows AbortError exceptions when request is cancelled', async () => {
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';

    const mockFetcher = vi.fn().mockRejectedValue(abortError);

    const { result } = renderHook(() =>
      useTopologyQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Fallback error',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
  });
});