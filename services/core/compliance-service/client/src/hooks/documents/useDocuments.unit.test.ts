// File: services/core/compliance-service/client/src/hooks/documents/useDocuments.unit.test.ts
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocuments } from './useDocuments';
import { apiClient } from '../../api';

// Mock the apiClient module
vi.mock('../../api', () => ({
  apiClient: {
    getDocuments: vi.fn(),
  },
}));

describe('useDocuments Hook', () => {
  const mockValidDocument = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    documentType: 'asset-transfer-authorization',
    storageBucket: 'compliance-vault',
    storageKey: 'doc.pdf',
    status: 'SIGNED',
    createdAt: '2026-09-27T12:00:00.000Z',
    updatedAt: '2026-09-27T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully fetches, validates, and returns documents on mount', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: [mockValidDocument],
    } as any);

    const { result } = renderHook(() => useDocuments());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.documents).toEqual([mockValidDocument]);
    });

    expect(apiClient.getDocuments).toHaveBeenCalledTimes(1);
  });

  it('handles non-200 HTTP responses by setting an error message', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 500,
      body: { message: 'Internal server error' },
    } as any);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Internal server error');
    });

    expect(result.current.documents).toEqual([]);
  });

  it('handles Zod validation failures when response body violates schema contract', async () => {
    const invalidDocument = {
      id: 'not-a-uuid', // Invalid schema shape
    };

    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: [invalidDocument],
    } as any);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTypeOf('string');
    });

    expect(result.current.documents).toEqual([]);
  });

  it('allows manual refetching via the refetch callback', async () => {
    vi.mocked(apiClient.getDocuments)
      .mockResolvedValueOnce({
        status: 200,
        body: [],
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        body: [mockValidDocument],
      } as any);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.documents).toEqual([]);
    });

    // Trigger refetch wrapped in act
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.documents).toEqual([mockValidDocument]);
      expect(result.current.error).toBeNull();
    });

    expect(apiClient.getDocuments).toHaveBeenCalledTimes(2);
  });
});