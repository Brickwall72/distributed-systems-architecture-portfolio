// File: services/core/topology-service/client/src/api/organizations/organizations.test.ts
import { fetchOrganizations } from './organizations';

describe('fetchOrganizations (Unit)', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches organizations without query params when none are provided', async () => {
    const mockData = [{ id: 'org-1', name: 'HQ Alpha', type: 'CONTRACTOR' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchOrganizations();

    expect(mockFetch).toHaveBeenCalledWith('/topology/api/v1/organizations', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual(mockData);
  });

  it('appends parentId parameter to the request URL when supplied', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await fetchOrganizations({ parentId: 'org-parent-101' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/topology/api/v1/organizations?parentId=org-parent-101',
      { headers: { Accept: 'application/json' } }
    );
  });

  it('throws an error when response status is not OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchOrganizations()).rejects.toThrow('Failed to fetch organizations (500)');
  });
});