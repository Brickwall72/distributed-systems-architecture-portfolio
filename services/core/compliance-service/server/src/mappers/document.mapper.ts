// File: services/core/compliance-service/server/src/mappers/document.mapper.ts
import { Document } from 'compliance-shared';

export function mapDbRowToDocument(row: any): Document {
  // Parse s3://bucket/key format if storageBucket/storageKey columns aren't separate yet
  let storageBucket = row.storage_bucket;
  let storageKey = row.storage_key;

  if (!storageBucket || !storageKey) {
    const s3Uri = row.s3_uri || '';
    const match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (match) {
      storageBucket = match[1];
      storageKey = match[2];
    } else {
      storageBucket = 'default-bucket';
      storageKey = s3Uri;
    }
  }

  let status: Document['status'];
  if (row.status === 'Approved') {
    status = 'SIGNED';
  } else if (row.status === 'Rejected') {
    status = 'REJECTED';
  } else {
    status = 'PENDING_SIGNATURE';
  }

  return {
    id: row.id,
    documentType: row.document_type,
    storageBucket,
    storageKey,
    status,
    signerId: row.signer_id,
    entityId: row.entity_id,
    transferEventId: row.transfer_event_id,
    fileHash: row.file_hash,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at || Date.now()).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at || row.created_at || Date.now()).toISOString(),
  };
}