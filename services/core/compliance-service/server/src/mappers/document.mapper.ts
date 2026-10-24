// File: services/core/compliance-service/server/src/mappers/document.mapper.ts
import { DocumentEntity } from "../domain";

export function mapDbRowToDocument(row: any): DocumentEntity {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    transferType: row.transfer_type,
    requisitionNumber: row.requisition_number,
    storageBucket: row.storage_bucket,
    storageKey: row.storage_key,
    status: row.status,
    signerId: row.signer_id,
    transferEventId: row.transfer_event_id || null,
    fileHash: row.file_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}