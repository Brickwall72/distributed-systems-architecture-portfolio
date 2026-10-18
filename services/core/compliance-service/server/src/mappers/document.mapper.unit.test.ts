// File: services/core/compliance-service/server/src/mappers/document.mapper.unit.test.ts
import { mapDbRowToDocument } from './document.mapper';
import { DocumentSchema } from 'compliance-shared';

describe('mapDbRowToDocument (Anti-Corruption Layer)', () => {
  it('correctly maps fully populated snake_case database row to camelCase Document DTO', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'asset-transfer-authorization',
      storage_bucket: 'compliance-vault',
      storage_key: '2026/dd1149.pdf',
      status: 'Approved',
      signer_id: 'user-789',
      entity_id: 'org-456',
      transfer_event_id: '423e4567-e89b-12d3-a456-426614174099',
      file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      created_at: new Date('2026-09-15T14:32:00.000Z'),
      updated_at: new Date('2026-09-15T15:00:00.000Z'),
    };

    const result = mapDbRowToDocument(dbRow);

    // Validate that the output strictly conforms to the shared Document DTO Zod schema
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

  it('parses bucket and key from s3_uri when separate storage columns are missing', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'asset-transfer-receipt',
      s3_uri: 's3://custom-bucket/path/to/doc.pdf',
      status: 'Rejected',
      created_at: '2026-09-15T14:32:00.000Z',
    };

    const result = mapDbRowToDocument(dbRow);

    expect(result.storageBucket).toBe('custom-bucket');
    expect(result.storageKey).toBe('path/to/doc.pdf');
    expect(result.status).toBe('REJECTED');
    expect(DocumentSchema.safeParse(result).success).toBe(true);
  });

  it('defaults storage bucket and maps pending statuses correctly for unhandled row states', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'contract-test-bare',
      s3_uri: 'relative-path-without-uri.pdf',
      status: 'PendingReview',
      created_at: new Date('2026-09-15T14:32:00.000Z'),
    };

    const result = mapDbRowToDocument(dbRow);

    expect(result.storageBucket).toBe('default-bucket');
    expect(result.storageKey).toBe('relative-path-without-uri.pdf');
    expect(result.status).toBe('PENDING_SIGNATURE');
    expect(DocumentSchema.safeParse(result).success).toBe(true);
  });
});