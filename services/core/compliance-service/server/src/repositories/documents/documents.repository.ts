// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.ts
import { Pool } from 'pg';
import { mapDbRowToDocument } from '../../mappers';
import { formIdEnum, formTypeEnum } from 'compliance-shared';
import { transferTypeEnum, transferStatusEnum } from '@contracts/common';
import { z } from 'zod';

export const insertDataSchema = z.object({
  documentId: z.string().uuid(),
  documentName: formIdEnum,
  documentType: formTypeEnum,
  transferType: transferTypeEnum,
  requisitionNumber: z.string(),
  storageBucket: z.string(),
  storageKey: z.string(),
  status: z.union([transferStatusEnum, z.literal('SIGNED')]),
  signerId: z.string(),
  fileHash: z.string(),
  transferEventId: z.string().uuid().optional(),
})
type InsertData = z.infer<typeof insertDataSchema>;

export const updateForDocNumberDataSchema = z.object({
  id: z.string().uuid(),
  status: transferStatusEnum,
})
type UpdateForDocNumberData = z.infer<typeof updateForDocNumberDataSchema>;

export const updateForReqNumberDataSchema = updateForDocNumberDataSchema.omit(
  {id: true}).extend({requisitionNumber: z.string(), transferEventId: z.string().uuid(),}
);
type UpdateForReqNumberData = z.infer<typeof updateForReqNumberDataSchema>;

export class DocumentsRepository {
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

  async insert(data: InsertData): Promise<ReturnType<typeof mapDbRowToDocument>> {
    const query = `
      INSERT INTO compliance_documents (
        id, name, type, transfer_type, requisition_number, storage_bucket, storage_key, status, signer_id, file_hash, transfer_event_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        transfer_type = EXCLUDED.transfer_type,
        requisition_number = EXCLUDED.requisition_number,
        storage_bucket = EXCLUDED.storage_bucket,
        storage_key = EXCLUDED.storage_key,
        status = EXCLUDED.status,
        signer_id = EXCLUDED.signer_id,
        file_hash = EXCLUDED.file_hash,
        transfer_event_id = COALESCE(EXCLUDED.transfer_event_id, compliance_documents.transfer_event_id)
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
      data.transferEventId ?? null,
    ];

    const { rows } = await this.db.query(query, values);
    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }

  async updateForDocNumber(data: UpdateForDocNumberData) {
    const query = `
      UPDATE compliance_documents
      SET status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await this.db.query(query, [data.status, data.id]);
    if (rows.length === 0) return null;
    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }

  async updateForReqNumber(data: UpdateForReqNumberData) {
    const query = `
      UPDATE compliance_documents
      SET transfer_event_id = $1,
          status = CASE
            WHEN (
              CASE $2
                WHEN 'SIGNED' THEN 1
                WHEN 'IN_PROGRESS' THEN 2
                WHEN 'PARTIALLY_COMPLETED' THEN 3
                WHEN 'COMPLETED' THEN 4
                ELSE 0
              END
            ) > (
              CASE status
                WHEN 'SIGNED' THEN 1
                WHEN 'IN_PROGRESS' THEN 2
                WHEN 'PARTIALLY_COMPLETED' THEN 3
                WHEN 'COMPLETED' THEN 4
                ELSE 0
              END
            ) THEN $2
            ELSE status
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE requisition_number = $3
      RETURNING *;
    `;
    const { rows } = await this.db.query(query, [
      data.transferEventId,
      data.status,
      data.requisitionNumber,
    ]);
    return rows.map((row) => mapDbRowToDocument(this.normalizeRow(row)));
  }

  async findAll(
    filters: { statuses?: string[]; requisitionNumbers?: string[] } = {}
  ): Promise<ReturnType<typeof mapDbRowToDocument>[]> {
    const conditions: string[] = [];
    const values: string[][] = [];
    if (filters.statuses?.length) {
      values.push(filters.statuses);
      conditions.push(`status = ANY($${values.length})`);
    }
    if (filters.requisitionNumbers?.length) {
      values.push(filters.requisitionNumbers);
      conditions.push(`requisition_number = ANY($${values.length})`);
    }
    const query = `
      SELECT *
      FROM compliance_documents
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC;
    `;
    const { rows } = await (values.length ? this.db.query(query, values) : this.db.query(query));
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

  async getRequisitionNumberById(id: string): Promise<string | null> {
    const query = `
      SELECT requisition_number
      FROM compliance_documents
      WHERE id = $1;
    `;
    const { rows } = await this.db.query(query, [id]);
    if (rows.length === 0) return null;

    return rows[0].requisition_number as string;
  }
}