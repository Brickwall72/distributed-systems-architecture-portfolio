// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.unit.test.ts
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
  topology_application_status: entity.topologyApplicationStatus,
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

    it('rejects a conflicting document replay', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await expect(repository.insert(mockFromSchema(insertDataSchema))).rejects.toThrow('Conflicting document metadata');
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

      const results = await repository.findAll({}, { kind: 'auditor' });

      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
      expect(results).toEqual([first, second]);
    });

    it('combines status and requisition number filters as parameterized conditions', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.findAll({ statuses: ['IN_PROGRESS'], requisitionNumbers: ['REQ-1', 'REQ-2'] }, { kind: 'auditor' });

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('WHERE status = ANY($1) AND requisition_number = ANY($2)');
      expect(params).toEqual([['IN_PROGRESS'], ['REQ-1', 'REQ-2']]);
    });

    it('filters on requisition numbers alone using the first parameter', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.findAll({ requisitionNumbers: ['REQ-1'] }, { kind: 'auditor' });

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('WHERE requisition_number = ANY($1)');
      expect(params).toEqual([['REQ-1']]);
    });

    it('returns an empty array when no documents exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      expect(await repository.findAll({}, { kind: 'auditor' })).toEqual([]);
    });
  });

  describe('findById', () => {
    it('retrieves a single document when found', async () => {
      const entity = mockFromSchema(documentEntitySchema);
      mockPool.query.mockResolvedValueOnce({ rows: [toDbRow(entity)] });

      const result = await repository.findById(entity.id, { kind: 'auditor' });

      const [query, values] = mockPool.query.mock.calls[0];
      expect(query).toContain('WHERE id = $1');
      expect(values).toEqual([entity.id]);
      expect(result).toEqual(entity);
    });

    it('returns null when a document is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      expect(await repository.findById(mockFromSchema(documentEntitySchema).id, { kind: 'auditor' })).toBeNull();
    });
  });

  it('requires both the matching transfer and a participant for member reads', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const scope = { kind: 'organization', orgId: 'org-a' } as const;
    await repository.findAll({ statuses: ['IN_PROGRESS'] }, scope);
    await repository.findById('document-id', scope);
    for (const [sql, values] of mockPool.query.mock.calls) {
      expect(sql).toContain('p.transfer_event_id = compliance_documents.transfer_event_id');
      expect(sql).toContain('p.sender_org_id');
      expect(sql).toContain('p.receiver_org_id');
      expect(values).toContain('org-a');
    }
  });

  it('rejects conflicting participant snapshots', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.recordTransferParticipants({
      requisitionNumber: 'REQ-1',
      transferEventId: '00000000-0000-4000-8000-000000000001',
      senderOrgId: 'sender',
      receiverOrgId: 'receiver',
    })).rejects.toThrow('Conflicting transfer participant metadata');
  });
});
