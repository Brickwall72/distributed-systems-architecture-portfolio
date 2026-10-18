// File: services/core/compliance-service/client/src/api/documents/documents.unit.test.ts
import { fetchDocuments } from './documents';
import { apiClient } from '../client';

vi.mock('../client', () => ({
  apiClient: {
    getDocuments: vi.fn(),
  },
}));

describe('Documents API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validDocuments = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      documentType: 'asset-transfer-authorization' as const,
      storageBucket: 'compliance-vault',
      storageKey: '2026/dd1149.pdf',
      status: 'SIGNED' as const,
      createdAt: '2026-09-15T14:32:00.000Z',
      updatedAt: '2026-09-15T14:32:00.000Z',
    },
  ];

  it('fetches documents dataset successfully and parses valid payload', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: validDocuments,
      headers: new Headers(),
    });

    const result = await fetchDocuments();

    expect(apiClient.getDocuments).toHaveBeenCalledOnce();
    expect(result).toEqual(validDocuments);
  });

  it('throws an error when server responds with non-200 status', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 500,
      body: { error: 'Internal Server Error' },
      headers: new Headers(),
    });

    await expect(fetchDocuments()).rejects.toThrow('Internal Server Error');
  });

  it('throws Zod error when API returns schema-violating payload', async () => {
    const corruptDocuments = [
      {
        id: 'invalid-uuid-string',
        documentType: 'DD-1149',
        storageBucket: 'vault',
        storageKey: 'file.pdf',
        status: 'UNKNOWN_STATUS',
        createdAt: 'bad-timestamp',
        updatedAt: 'bad-timestamp',
      },
    ];

    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: corruptDocuments as unknown as typeof validDocuments,
      headers: new Headers(),
    });

    await expect(fetchDocuments()).rejects.toThrow();
  });
});