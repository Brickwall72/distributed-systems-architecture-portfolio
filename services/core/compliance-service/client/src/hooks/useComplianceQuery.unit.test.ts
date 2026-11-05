// File: services/core/compliance-service/client/src/hooks/useComplianceQuery.unit.test.ts
import { setTestSession } from '@shared/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComplianceQuery } from './useComplianceQuery';

describe('useComplianceQuery', () => {
  beforeEach(() => {
    setTestSession();
  });

  it('does not fetch and is idle when disabled', () => {
    const mockFetcher = vi.fn();

    const { result } = renderHook(() =>
      useComplianceQuery({ fetcher: mockFetcher, fallbackErrorMessage: 'Failed', enabled: false })
    );

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current).toEqual({ data: null, isLoading: false, error: null });
  });

  it('successfully fetches and sets data on 200 OK', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: { message: 'success' },
    });

    const { result } = renderHook(() =>
      useComplianceQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Failed to fetch',
      })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ message: 'success' });
    expect(result.current.error).toBeNull();
  });

  it('extracts error message from response body on non-200 status', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 404,
      body: { error: 'Resource not found' },
    });

    const { result } = renderHook(() =>
      useComplianceQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Fallback error message',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Resource not found');
  });

  it('falls back to fallbackErrorMessage when network exception occurs', async () => {
    const mockFetcher = vi.fn().mockRejectedValue(new Error(''));

    const { result } = renderHook(() =>
      useComplianceQuery({
        fetcher: mockFetcher,
        fallbackErrorMessage: 'Custom network fallback error',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Custom network fallback error');
  });

  it('stays idle without a signed-in identity and fetches once one is selected, without a remount', async () => {
    setTestSession(null);
    const mockFetcher = vi.fn().mockResolvedValue({ status: 200, body: [] });

    const { result } = renderHook(() => useComplianceQuery({ fetcher: mockFetcher, fallbackErrorMessage: 'Failed' }));

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.error).toBeFalsy();

    act(() => setTestSession());

    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
  });
});