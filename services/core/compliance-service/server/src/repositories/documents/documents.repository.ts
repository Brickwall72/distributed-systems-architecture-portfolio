// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.ts
import { Pool } from 'pg';
import { mapDbRowToDocument } from '../../mappers';
import { formNameEnum, formTypeEnum } from 'compliance-shared';
import { transferTypeEnum } from '@contracts/common';
import { z } from 'zod';

export const insertInputSchema = z.object({
  documentId: z.string().uuid(),
  documentName: formNameEnum,
  documentType: formTypeEnum,
  transferType: transferTypeEnum,
  requisitionNumber: z.string(),
  storageBucket: z.string(),
  storageKey: z.string(),
  status: z.enum(['SIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED']),
  signerId: z.string(),
  fileHash: z.string(),
})

type InsertInputs = z.infer<typeof insertInputSchema>;

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

  async insert(data: InsertInputs): Promise<ReturnType<typeof mapDbRowToDocument>> {
    const query = `
      INSERT INTO compliance_documents (
        id, name, type, transfer_type, requisition_number, storage_bucket, storage_key, status, signer_id, file_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        transfer_type = EXCLUDED.transfer_type,
        requisition_number = EXCLUDED.requisition_number,
        storage_bucket = EXCLUDED.storage_bucket,
        storage_key = EXCLUDED.storage_key,
        status = EXCLUDED.status,
        signer_id = EXCLUDED.signer_id,
        file_hash = EXCLUDED.file_hash
      RETURNING *;
    `;

    const values = [
      data.documentId,
      data.documentName,
      data.documentType,
      data.transferType,
      data.requisitionNumber,
      data.storageBucket,
      data.storageKey,
      data.status,
      data.signerId,
      data.fileHash,
    ];

    const { rows } = await this.db.query(query, values);
    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }

  async findAll(): Promise<ReturnType<typeof mapDbRowToDocument>[]> {
    const query = `
      SELECT *
      FROM compliance_documents
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.db.query(query);
    return rows.map((row) => mapDbRowToDocument(this.normalizeRow(row)));
  }

  async findById(id: string): Promise<ReturnType<typeof mapDbRowToDocument> | null> {
    const query = `
      SELECT *
      FROM compliance_documents
      WHERE id = $1;
    `;
    const { rows } = await this.db.query(query, [id]);
    if (rows.length === 0) return null;

    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }
}