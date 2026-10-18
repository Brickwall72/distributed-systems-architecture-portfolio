// File: services/core/compliance-service/server/src/mappers/document.mapper.unit.test.ts
import { mapDbRowToDocument } from './document.mapper';
import { DocumentSchema } from 'compliance-shared';

describe('mapDbRowToDocument (Anti-Corruption Layer)', () => {
  it('correctly maps fully populated database row to Document DTO', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'asset-transfer-authorization',
      bucket: 'compliance-vault',
      object_key: '2026/dd1149.pdf',
      status: 'SIGNED',
      signer_id: 'user-789',
      entity_id: 'org-456',
      transfer_event_id: '423e4567-e89b-12d3-a456-426614174099',
      document_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      created_at: new Date('2026-09-15T14:32:00.000Z'),
      updated_at: new Date('2026-09-15T15:00:00.000Z'),
    };

    const result = mapDbRowToDocument(dbRow);

    const parsed = DocumentSchema.safeParse(result);
    expect(parsed.success).toBe(true);

    expect(result).toEqual({
      id: '123e4567-e89b-12d3-a456-426614174000',
      documentType: 'asset-transfer-authorization',
      storageBucket: 'compliance-vault',
      storageKey: '2026/dd1149.pdf',
      status: 'SIGNED',
      signerId: 'user-789',
      entityId: 'org-456',
      transferEventId: '423e4567-e89b-12d3-a456-426614174099',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      createdAt: '2026-09-15T14:32:00.000Z',
      updatedAt: '2026-09-15T15:00:00.000Z',
    });
  });

  it('correctly maps minimal pending database row with optional fields omitted', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'asset-transfer-receipt',
      bucket: 'compliance-vault',
      object_key: 'pending/doc.pdf',
      status: 'PENDING_SIGNATURE',
      created_at: '2026-09-15T14:32:00.000Z',
      updated_at: '2026-09-15T14:32:00.000Z',
    };

    const result = mapDbRowToDocument(dbRow);

    expect(result.status).toBe('PENDING_SIGNATURE');
    expect(result.signerId).toBeUndefined();
    expect(result.fileHash).toBeUndefined();
    expect(DocumentSchema.safeParse(result).success).toBe(true);
  });
});