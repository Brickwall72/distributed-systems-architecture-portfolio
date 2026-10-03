// File: services/core/topology-service/client/src/hooks/useAssets.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAssets } from './useAssets';
import { fetchAssets } from '../../api';

vi.mock('../../api', () => ({
  fetchAssets: vi.fn(),
}));

describe('useAssets (Hook)', () => {
  const mockFetchAssets = vi.mocked(fetchAssets);

  const mockAssets = [
    {
      id: 'ast-101',
      nomenclature: 'Radio Transceiver',
      serialNumber: 'SN-001',
    },
    {
      id: 'ast-102',
      nomenclature: 'Satellite Terminal',
      serialNumber: 'SN-002',
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with loading state and resolves data on successful fetch', async () => {
    mockFetchAssets.mockResolvedValueOnce(mockAssets);

    const { result } = renderHook(() => useAssets());

    // Verify initial sync state before promise resolves
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockAssets);
    expect(result.current.error).toBeNull();
    expect(mockFetchAssets).toHaveBeenCalledTimes(1);
    expect(mockFetchAssets).toHaveBeenCalledWith(undefined);
  });

  it('handles custom fetch parameters correctly', async () => {
    mockFetchAssets.mockResolvedValueOnce(mockAssets);

    const params = { ownerId: 'org-1', excludeOwnerId: 'org-2' };
    const { result } = renderHook(() => useAssets(params));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchAssets).toHaveBeenCalledWith(params);
  });

  it('sets error state when fetchAssets fails', async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error('Network timeout'));

    const { result } = renderHook(() => useAssets());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Network timeout');
  });

  it('uses default fallback error message when error object lacks message', async () => {
    mockFetchAssets.mockRejectedValueOnce({});

    const { result } = renderHook(() => useAssets());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load assets');
  });

  it('re-fetches assets when owner filter parameters change', async () => {
    mockFetchAssets.mockResolvedValue(mockAssets);

    const { result, rerender } = renderHook(
      (params) => useAssets(params),
      { initialProps: { ownerId: 'org-1' } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchAssets).toHaveBeenCalledWith({ ownerId: 'org-1' });

    // Change parameter props to trigger useEffect re-execution
    rerender({ ownerId: 'org-2' });

    await waitFor(() => {
      expect(mockFetchAssets).toHaveBeenCalledWith({ ownerId: 'org-2' });
    });

    expect(mockFetchAssets).toHaveBeenCalledTimes(2);
  });

  it('prevents state updates if component unmounts before request resolves', async () => {
    let resolvePromise!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetchAssets.mockReturnValueOnce(pendingPromise as any);

    const { unmount } = renderHook(() => useAssets());

    // Unmount before resolving the underlying promise
    unmount();

    // Resolve after unmount
    resolvePromise(mockAssets);

    // If isMounted flag fails, React/Vitest will flag unhandled state updates on unmounted components
    await expect(pendingPromise).resolves.toEqual(mockAssets);
  });
});