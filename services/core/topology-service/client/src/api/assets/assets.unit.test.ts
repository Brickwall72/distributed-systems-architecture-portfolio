// File: services/core/topology-service/client/src/api/assets/assets.unit.test.ts
import { fetchAssets } from './assets';

describe('fetchAssets (Unit)', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches assets without query params when none are provided', async () => {
    const mockData = [{ id: 'ast-1', nomenclature: 'Radio', serialNumber: '123' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchAssets();

    expect(mockFetch).toHaveBeenCalledWith('/topology/api/v1/assets', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual(mockData);
  });

  it('appends ownerId and excludeOwnerId parameters to the request URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await fetchAssets({ ownerId: 'org-101', excludeOwnerId: 'org-202' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/topology/api/v1/assets?ownerId=org-101&excludeOwnerId=org-202',
      { headers: { Accept: 'application/json' } }
    );
  });

  it('throws an error when response status is not OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchAssets()).rejects.toThrow('Failed to fetch assets (500)');
  });
});