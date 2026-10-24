import { renderHook, waitFor, act } from '@testing-library/react';
import { DocumentSchema } from 'compliance-shared';
import { mockFromSchema } from '@shared/testing';
import { useDocuments } from './useDocuments';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: {
    getDocuments: vi.fn(),
  },
}));

describe('useDocuments Hook', () => {
  const mockDocument = () => mockFromSchema(DocumentSchema);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches, validates, and returns documents on mount', async () => {
    const docs = [mockDocument(), mockDocument()];
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({ status: 200, body: docs } as never);

    const { result } = renderHook(() => useDocuments());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.documents).toEqual(docs);
    });

    expect(apiClient.getDocuments).toHaveBeenCalledTimes(1);
  });

  it('handles non-200 HTTP responses by setting an error message', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 500,
      body: { message: 'Internal server error' },
    } as never);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Internal server error');
    });

    expect(result.current.documents).toEqual([]);
  });

  it('handles schema violations in the response body', async () => {
    const invalid = { ...mockDocument(), status: 'NOT_A_STATUS' };
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({ status: 200, body: [invalid] } as never);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTypeOf('string');
    });

    expect(result.current.documents).toEqual([]);
  });

  it('allows manual refetching via the refetch callback', async () => {
    const docs = [mockDocument()];
    vi.mocked(apiClient.getDocuments)
      .mockResolvedValueOnce({ status: 200, body: [] } as never)
      .mockResolvedValueOnce({ status: 200, body: docs } as never);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.documents).toEqual([]);
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.documents).toEqual(docs);
      expect(result.current.error).toBeNull();
    });

    expect(apiClient.getDocuments).toHaveBeenCalledTimes(2);
  });
});
