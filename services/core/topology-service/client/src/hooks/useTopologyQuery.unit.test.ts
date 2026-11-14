// File: services/core/topology-service/client/src/hooks/useTopologyQuery.unit.test.ts
import { setTestSession } from '@shared/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTopologyQuery } from './useTopologyQuery';

describe('useTopologyQuery (Base Hook Primitives)', () => {
  beforeEach(() => {
    setTestSession();
  });

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

  it('reports an unexpected AbortError instead of treating it as a successful empty result', async () => {
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

    expect(result.current.error).toBe('The user aborted a request.');
    expect(result.current.items).toEqual([]);
  });

  it('stays idle without a signed-in identity and fetches once one is selected, without a remount', async () => {
    setTestSession(null);
    const mockFetcher = vi.fn().mockResolvedValue({ status: 200, body: [] });

    const { result } = renderHook(() => useTopologyQuery({ fetcher: mockFetcher, fallbackErrorMessage: 'Failed' }));

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.error).toBeFalsy();

    act(() => setTestSession());

    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
  });

  it('clears previous results and ignores late responses when query parameters change', async () => {
    let resolveOld!: (value: { status: number; body: { id: string }[] }) => void;
    const mockFetcher = vi.fn()
      .mockResolvedValueOnce({ status: 200, body: [{ id: 'initial' }] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ status: 200, body: [{ id: 'current' }] });
    const { result, rerender } = renderHook(
      ({ filter }) => useTopologyQuery({ params: { filter }, fetcher: mockFetcher, fallbackErrorMessage: 'Failed' }),
      { initialProps: { filter: 'initial' } },
    );

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'initial' }]));
    rerender({ filter: 'old' });
    expect(result.current.items).toEqual([]);
    rerender({ filter: 'current' });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'current' }]));
    await act(async () => resolveOld({ status: 200, body: [{ id: 'old' }] }));
    expect(result.current.items).toEqual([{ id: 'current' }]);
  });

  it('refetches and clears results when an identity changes organization without changing its id', async () => {
    let resolveSecond!: (value: { status: number; body: { id: string }[] }) => void;
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ status: 200, body: [{ id: 'first-org-asset' }] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const { result } = renderHook(() => useTopologyQuery({ fetcher, fallbackErrorMessage: 'Failed' }));

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'first-org-asset' }]));
    act(() => setTestSession('another-org'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(result.current.items).toEqual([]);
    await act(async () => resolveSecond({ status: 200, body: [{ id: 'second-org-asset' }] }));
    expect(result.current.items).toEqual([{ id: 'second-org-asset' }]);
  });
});