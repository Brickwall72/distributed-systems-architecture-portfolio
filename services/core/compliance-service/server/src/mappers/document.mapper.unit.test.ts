import { mockFromSchema } from '@shared/testing';
import { mapDbRowToDocument } from './document.mapper';
import { documentEntitySchema, type DocumentEntity } from '../domain';

const toDbRow = (entity: DocumentEntity) => ({
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
});

describe('mapDbRowToDocument (Anti-Corruption Layer)', () => {
  it('maps a database row back to a schema-valid document entity', () => {
    const entity = mockFromSchema(documentEntitySchema);

    const result = mapDbRowToDocument(toDbRow(entity));

    expect(documentEntitySchema.safeParse(result).success).toBe(true);
    expect(result).toEqual(entity);
  });

  it('maps a missing transfer_event_id to null', () => {
    const entity = mockFromSchema(documentEntitySchema, { transferEventId: null });
    const row = { ...toDbRow(entity), transfer_event_id: undefined };

    const result = mapDbRowToDocument(row);

    expect(result.transferEventId).toBeNull();
    expect(documentEntitySchema.safeParse(result).success).toBe(true);
  });
});
