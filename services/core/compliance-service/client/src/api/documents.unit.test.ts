// File: services/core/compliance-service/client/src/api/documents.unit.test.ts
import { fetchDocuments } from './documents';

describe('fetchDocuments Unit Tests', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches and validates documents successfully', async () => {
    const mockData = [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      document_type: 'DD1149-asset-transfer.pdf',
      s3_uri: 's3/uri/location/pdf.pdf',
      status: 'Approved',
      created_at: '2026-09-13T21:00:20Z',
      extra_column: 'should be ignored by UI' // Testing the .catchall(z.unknown())
    }];
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);

    const result = await fetchDocuments();
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/compliance/api/v1/documents/');
  });

  it('throws an error on invalid schema payload', async () => {
    const invalidData = [{
      id: 'not-a-uuid',
      status: 'InvalidStatus' 
      // missing document_ref and created_at
    }];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => invalidData
    } as Response);

    await expect(fetchDocuments()).rejects.toThrow(/invalid_type/i);
  });
});