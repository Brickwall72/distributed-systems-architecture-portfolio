// File: services/core/compliance-service/client/src/hooks/useComplianceQuery.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useComplianceQuery } from './useComplianceQuery';

describe('useComplianceQuery', () => {
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
});