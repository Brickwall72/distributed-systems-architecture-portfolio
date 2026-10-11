// File: services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTemplatesQuery } from './useTemplatesQuery';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    getTemplates: vi.fn(),
  },
}));

describe('useTemplatesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guarantees an empty array fallback when data is null', async () => {
    vi.mocked(apiClient.getTemplates).mockResolvedValue({
      status: 200,
      body: null as any,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useTemplatesQuery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns template manifests correctly when populated', async () => {
    const mockManifests = [{ id: 't1', name: 'Form A', type: 'AUTHORIZATION' }];
    vi.mocked(apiClient.getTemplates).mockResolvedValue({
      status: 200,
      body: mockManifests as any,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useTemplatesQuery({ type: 'AUTHORIZATION' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockManifests);
    expect(apiClient.getTemplates).toHaveBeenCalledWith({
      query: { type: 'AUTHORIZATION' },
      fetchOptions: expect.any(Object),
    });
  });
});