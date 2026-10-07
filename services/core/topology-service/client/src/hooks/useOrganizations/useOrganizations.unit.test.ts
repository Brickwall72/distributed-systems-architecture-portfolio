// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useOrganizations } from './useOrganizations';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    getOrganizations: vi.fn(),
  },
}));

describe('useOrganizations (Contract Routing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates query parameters directly to apiClient.getOrganizations', async () => {
    vi.mocked(apiClient.getOrganizations).mockResolvedValue({
      status: 200,
      body: [],
      headers: new Headers(),
    });

    const query = { filterOwnedId: 'ast-101' };
    const { result } = renderHook(() => useOrganizations(query));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getOrganizations).toHaveBeenCalledWith({
      query,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
  });
});