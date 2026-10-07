// File: services/core/topology-service/client/src/hooks/useAssets/useAssets.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAssets } from '../useAssets';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    getAssets: vi.fn(),
  },
}));

describe('useAssets (Contract Routing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates query parameters directly to apiClient.getAssets', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 200,
      body: [],
      headers: new Headers(),
    });

    const query = { filterOwnerId: 'org-10' };
    const { result } = renderHook(() => useAssets(query));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getAssets).toHaveBeenCalledWith({
      query,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });
});