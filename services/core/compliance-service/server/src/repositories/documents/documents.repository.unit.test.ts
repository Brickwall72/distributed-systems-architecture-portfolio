import { Pool } from 'pg';
import { mockFromSchema } from '@shared/testing';
import { DocumentsRepository, insertDataSchema } from './documents.repository';
import { documentEntitySchema, type DocumentEntity } from '../../domain';

const toDbRow = (entity: DocumentEntity, overrides: Record<string, unknown> = {}) => ({
  id: entity.id,
  name: entity.name,
  type: entity.type,
  transfer_type: entity.transferType,
  requisition_number: entity.requisitionNumber,
  storage_bucket: entity.storageBucket,
  storage_key: entity.storageKey,
  status: entity.status,
  signer_id: entity.signerId,
  transfer_event_id: entity.transferEventId,
  file_hash: entity.fileHash,
  created_at: entity.createdAt,
  updated_at: entity.updatedAt,
  ...overrides,
});

describe('DocumentsRepository', () => {
  let repository: DocumentsRepository;
  let mockPool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = { query: vi.fn() };
    repository = new DocumentsRepository(mockPool as unknown as Pool);
  });

  describe('insert', () => {
    it('persists a schema-generated document and returns a valid entity', async () => {
      const input = mockFromSchema(insertDataSchema);
      const entity = mockFromSchema(documentEntitySchema, {
        id: input.documentId,
        name: input.documentName,
        type: input.documentType,
        transferType: input.transferType,
        requisitionNumber: input.requisitionNumber,
        storageBucket: input.storageBucket,
        storageKey: input.storageKey,
        status: input.status,
        signerId: input.signerId,
        fileHash: input.fileHash,
      });
      mockPool.query.mockResolvedValueOnce({ rows: [toDbRow(entity)] });

      const result = await repository.insert(input);

      const [query, values] = mockPool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO compliance_documents');
      expect(values).toEqual([
        input.documentId,
        input.documentName,
        input.documentType,
        input.transferType,
        input.requisitionNumber,
        input.storageBucket,
        input.storageKey,
        input.status,
        input.signerId,
        input.fileHash,
        input.transferEventId ?? null,
      ]);
      expect(documentEntitySchema.parse(result)).toEqual(entity);
    });
  });

  describe('findAll', () => {
    it('normalizes Date timestamps and keeps the query ordering', async () => {
      const first = mockFromSchema(documentEntitySchema);
      const second = mockFromSchema(documentEntitySchema);
      mockPool.query.mockResolvedValueOnce({
        rows: [
          toDbRow(first, { created_at: new Date(first.createdAt), updated_at: new Date(first.updatedAt) }),
          toDbRow(second),
        ],
      });

      const results = await repository.findAll();

      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(results).toEqual([first, second]);
    });

    it('returns an empty array when no documents exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      expect(await repository.findAll()).toEqual([]);
    });
  });

  describe('findById', () => {
    it('retrieves a single document when found', async () => {
      const entity = mockFromSchema(documentEntitySchema);
      mockPool.query.mockResolvedValueOnce({ rows: [toDbRow(entity)] });

      const result = await repository.findById(entity.id);

      const [query, values] = mockPool.query.mock.calls[0];
      expect(query).toContain('WHERE id = $1');
      expect(values).toEqual([entity.id]);
      expect(result).toEqual(entity);
    });

    it('returns null when a document is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      expect(await repository.findById(mockFromSchema(documentEntitySchema).id)).toBeNull();
    });
  });
});
