// File: services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCreateAsset } from './useCreateAsset';
import { apiClient } from '../../api';
import type { AssetDTO } from '@contracts/topology';

vi.mock('../../api', () => ({
  apiClient: {
    createAsset: vi.fn(),
  },
}));

describe('useCreateAsset Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAsset: AssetDTO = {
    id: 'ast-101',
    name: 'GPS Receiver',
    nomenclature: 'DAGR',
    serialNumber: 'SN-77892',
    status: 'AVAILABLE',
    currentOwnerId: 'org-10',
  };

  it('successfully creates an asset, clears previous errors, and returns response body', async () => {
    vi.mocked(apiClient.createAsset).mockResolvedValueOnce({
      status: 201,
      body: mockAsset,
    } as any);

    const { result } = renderHook(() => useCreateAsset());

    let createdAsset;
    await act(async () => {
      createdAsset = await result.current.createAsset(mockAsset);
    });

    expect(createdAsset).toEqual(mockAsset);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(apiClient.createAsset).toHaveBeenCalledWith({ body: mockAsset });
  });

  it('handles non-201 responses by setting error from response body', async () => {
    vi.mocked(apiClient.createAsset).mockResolvedValueOnce({
      status: 400,
      body: { error: 'Asset ID already registered' },
    } as any);

    const { result } = renderHook(() => useCreateAsset());

    let createdAsset;
    await act(async () => {
      createdAsset = await result.current.createAsset(mockAsset);
    });

    expect(createdAsset).toBeNull();
    expect(result.current.error).toBe('Asset ID already registered');
    expect(result.current.isLoading).toBe(false);
  });

  it('handles unexpected exceptions and network errors gracefully', async () => {
    vi.mocked(apiClient.createAsset).mockRejectedValueOnce(new Error('Network connection timeout'));

    const { result } = renderHook(() => useCreateAsset());

    let createdAsset;
    await act(async () => {
      createdAsset = await result.current.createAsset(mockAsset);
    });

    expect(createdAsset).toBeNull();
    expect(result.current.error).toBe('Network connection timeout');
    expect(result.current.isLoading).toBe(false);
  });
});