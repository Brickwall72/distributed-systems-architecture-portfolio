// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.unit.test.ts
import { Pool } from 'pg';
import { ComplianceDocumentRepository } from './documents.repository.js';

describe('ComplianceDocumentRepository', () => {
  let repository: ComplianceDocumentRepository;
  let mockPool: { query: ReturnType<typeof vi.fn> };

  const mockDbRow = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    document_type: 'DD-1149',
    s3_uri: 's3://dsap/org_armory_01/doc_101.pdf',
    status: 'Pending',
    created_at: '2026-09-17T12:00:00.000Z',
    updated_at: '2026-09-17T12:00:00.000Z',
  };

  const expectedMappedDocument = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    documentType: 'DD-1149',
    storageBucket: 'dsap',
    storageKey: 'org_armory_01/doc_101.pdf',
    status: 'PENDING_SIGNATURE',
    signerId: undefined,
    entityId: undefined,
    transferEventId: undefined,
    fileHash: undefined,
    createdAt: '2026-09-17T12:00:00.000Z',
    updatedAt: '2026-09-17T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = {
      query: vi.fn(),
    };
    repository = new ComplianceDocumentRepository(mockPool as unknown as Pool);
  });

  describe('create', () => {
    it('successfully persists a new compliance document and returns the parsed record', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

      const input = {
        id: mockDbRow.id,
        document_type: mockDbRow.document_type,
        s3_uri: mockDbRow.s3_uri,
        status: 'Pending' as const,
      };

      const result = await repository.create(input);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [query, values] = mockPool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO compliance_documents');
      expect(values).toEqual([input.id, input.document_type, input.s3_uri, input.status]);
      expect(result).toEqual(expectedMappedDocument);
    });
  });

  describe('findAll', () => {
    it('retrieves and normalizes a list of compliance documents ordered by creation date', async () => {
      const secondRow = {
        ...mockDbRow,
        id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        created_at: new Date('2026-09-18T14:30:00.000Z'),
        updated_at: new Date('2026-09-18T14:30:00.000Z'),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [secondRow, mockDbRow] });

      const results = await repository.findAll();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(results).toHaveLength(2);
      expect(results[0].createdAt).toBe('2026-09-18T14:30:00.000Z');
      expect(results[1].createdAt).toBe('2026-09-17T12:00:00.000Z');
    });

    it('returns an empty array when no documents exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const results = await repository.findAll();

      expect(results).toEqual([]);
    });
  });

  describe('findById', () => {
    it('retrieves a single compliance document when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await repository.findById(mockDbRow.id);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [query, values] = mockPool.query.mock.calls[0];
      expect(query).toContain('WHERE id = $1');
      expect(values).toEqual([mockDbRow.id]);
      expect(result).toEqual(expectedMappedDocument);
    });

    it('returns null when a compliance document is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

      expect(result).toBeNull();
    });
  });
});