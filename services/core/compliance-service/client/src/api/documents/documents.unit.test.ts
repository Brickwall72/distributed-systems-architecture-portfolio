// File: services/core/compliance-service/client/src/api/documents/documents.unit.test.ts
import { fetchDocuments } from './documents';
import { setApiBaseUrl } from '../client-config';

describe('Documents API Unit Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setApiBaseUrl('http://localhost:3000');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setApiBaseUrl('');
  });

  const validDocuments = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'DD-1149',
      s3_uri: 's3://compliance-vault/2026/dd1149.pdf',
      status: 'Approved',
      created_at: '2026-09-15T14:32:00Z',
    },
  ];

  it('fetches documents dataset from configured base URL and parses valid payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => validDocuments,
    } as Response);

    const result = await fetchDocuments();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/compliance/api/v1/documents/');
    expect(result).toEqual(validDocuments);
  });

  it('formats HTTP status error message when server responds with non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(fetchDocuments()).rejects.toThrow(
      'Failed to fetch documents dataset: 500 Internal Server Error'
    );
  });

  it('throws Zod error when API returns schema-violating payload', async () => {
    const corruptDocuments = [
      {
        id: 'invalid-uuid-string',
        document_type: 'DD-1149',
        s3_uri: 's3://vault/file.pdf',
        status: 'UNKNOWN_STATUS',
        created_at: 'bad-timestamp',
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => corruptDocuments,
    } as Response);

    await expect(fetchDocuments()).rejects.toThrow();
  });
});