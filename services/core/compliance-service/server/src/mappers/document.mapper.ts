// File: services/core/compliance-service/server/src/mappers/document.mapper.ts
import { Document } from 'compliance-shared';

export function mapDbRowToDocument(row: any): Document {
  return {
    id: row.id,
    documentType: row.document_type,
    storageBucket: row.bucket,
    storageKey: row.object_key,
    status: row.status,
    signerId: row.signer_id || undefined,
    entityId: row.entity_id || undefined,
    transferEventId: row.transfer_event_id || undefined,
    fileHash: row.document_hash || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at || Date.now()).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at || row.created_at || Date.now()).toISOString(),
  };
}