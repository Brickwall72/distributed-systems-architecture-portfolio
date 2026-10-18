// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.ts
import { Pool } from 'pg';
import { mapDbRowToDocument } from '../../mappers';

export interface UpsertComplianceDocumentInput {
  id: string;
  documentType: string;
  bucket: string;
  objectKey: string;
  status: 'PENDING_SIGNATURE' | 'SIGNED' | 'REJECTED' | 'SUPERSEDED';
  signerId?: string;
  entityId?: string;
  transferEventId?: string;
  documentHash?: string;
}

export class ComplianceDocumentRepository {
  constructor(private readonly db: Pool) {}

  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    if (!row) return row;
    let createdAt: unknown = row.created_at;
    let updatedAt: unknown = row.updated_at;

    if (createdAt instanceof Date) createdAt = createdAt.toISOString();
    if (updatedAt instanceof Date) updatedAt = updatedAt.toISOString();

    return {
      ...row,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  async upsert(data: UpsertComplianceDocumentInput): Promise<ReturnType<typeof mapDbRowToDocument>> {
    const query = `
      INSERT INTO compliance_documents (
        id, document_type, bucket, object_key, status, signer_id, entity_id, transfer_event_id, document_hash, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        document_type = EXCLUDED.document_type,
        bucket = EXCLUDED.bucket,
        object_key = EXCLUDED.object_key,
        status = EXCLUDED.status,
        signer_id = COALESCE(EXCLUDED.signer_id, compliance_documents.signer_id),
        entity_id = COALESCE(EXCLUDED.entity_id, compliance_documents.entity_id),
        document_hash = COALESCE(EXCLUDED.document_hash, compliance_documents.document_hash),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, document_type, bucket, object_key, status, signer_id, entity_id, transfer_event_id, document_hash, created_at, updated_at;
    `;

    const values = [
      data.id,
      data.documentType,
      data.bucket,
      data.objectKey,
      data.status,
      data.signerId || null,
      data.entityId || null,
      data.transferEventId || null,
      data.documentHash || null,
    ];

    const { rows } = await this.db.query(query, values);
    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }

  async findAll(): Promise<ReturnType<typeof mapDbRowToDocument>[]> {
    const query = `
      SELECT id, document_type, bucket, object_key, status, signer_id, entity_id, transfer_event_id, document_hash, created_at, updated_at
      FROM compliance_documents
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.db.query(query);
    return rows.map((row) => mapDbRowToDocument(this.normalizeRow(row)));
  }

  async findById(id: string): Promise<ReturnType<typeof mapDbRowToDocument> | null> {
    const query = `
      SELECT id, document_type, bucket, object_key, status, signer_id, entity_id, transfer_event_id, document_hash, created_at, updated_at
      FROM compliance_documents
      WHERE id = $1;
    `;
    const { rows } = await this.db.query(query, [id]);
    if (rows.length === 0) return null;

    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }
}