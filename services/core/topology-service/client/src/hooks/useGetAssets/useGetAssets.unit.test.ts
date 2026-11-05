// File: services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.unit.test.ts
import { setTestSession } from '@shared/testing';
import { renderHook, waitFor } from '@testing-library/react';
import { useGetAssets } from '.';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: {
    getAssets: vi.fn(),
  },
}));

describe('useGetAssets (Contract Routing)', () => {
  beforeEach(() => {
    setTestSession();
    vi.clearAllMocks();
  });

  it('delegates query parameters directly to apiClient.getAssets', async () => {
    vi.mocked(apiClient.getAssets).mockResolvedValue({
      status: 200,
      body: [],
      headers: new Headers(),
    });

    const query = {
      filterOwnerId: 'org-10',
      includeInTransit: false,
      includeAvailable: true,
    };
    const { result } = renderHook(() => useGetAssets(query));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getAssets).toHaveBeenCalledWith({
      query,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });
});