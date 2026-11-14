// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.ts
import { Pool } from 'pg';
import { mapDbRowToDocument } from '../../mappers';
import { formIdEnum, formTypeEnum } from 'compliance-shared';
import { transferTypeEnum, transferStatusEnum } from '@contracts/common';
import { DOCUMENT_STATUS } from '@contracts/compliance';
import { z } from 'zod';
import type { AccessScope } from '@shared/express';
import { draftBindingSchema, type DraftBinding } from './draft-binding';

export const insertDataSchema = z.object({
  documentId: z.string().uuid(),
  documentName: formIdEnum,
  documentType: formTypeEnum,
  transferType: transferTypeEnum,
  requisitionNumber: z.string(),
  storageBucket: z.string(),
  storageKey: z.string(),
  status: z.union([transferStatusEnum, z.literal(DOCUMENT_STATUS.SIGNED)]),
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

const documentSelection = `compliance_documents.*,
  CASE WHEN EXISTS (
    SELECT 1 FROM compliance_signed_outbox o
    WHERE o.document_id = compliance_documents.id AND o.published_at IS NULL AND o.last_error IS NOT NULL
  ) THEN 'ATTENTION_REQUIRED' ELSE compliance_documents.topology_application_status END AS topology_application_status`;

export class DocumentsRepository {
  constructor(private readonly db: Pool) {}

  async saveDraftBinding(binding: DraftBinding, creatorId: string, creatorOrgId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO compliance_draft_bindings (document_id, creator_id, creator_org_id, binding)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [binding.documentId, creatorId, creatorOrgId, JSON.stringify(draftBindingSchema.parse(binding))]);
  }

  async findDraftBinding(documentId: string, creatorId: string, creatorOrgId: string): Promise<DraftBinding | null> {
    const { rows } = await this.db.query<{ binding: unknown }>(`
      SELECT binding FROM compliance_draft_bindings
      WHERE document_id = $1 AND creator_id = $2 AND creator_org_id = $3
    `, [documentId, creatorId, creatorOrgId]);
    return rows[0] ? draftBindingSchema.parse(rows[0].binding) : null;
  }

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
        id = compliance_documents.id
      WHERE compliance_documents.name = EXCLUDED.name
        AND compliance_documents.type = EXCLUDED.type
        AND compliance_documents.transfer_type = EXCLUDED.transfer_type
        AND compliance_documents.requisition_number = EXCLUDED.requisition_number
        AND compliance_documents.storage_bucket = EXCLUDED.storage_bucket
        AND compliance_documents.storage_key = EXCLUDED.storage_key
        AND compliance_documents.signer_id = EXCLUDED.signer_id
        AND compliance_documents.file_hash = EXCLUDED.file_hash
        AND (EXCLUDED.transfer_event_id IS NULL OR compliance_documents.transfer_event_id = EXCLUDED.transfer_event_id)
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
    if (!rows.length) throw new Error('Conflicting document metadata');
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

  async markTopologyApplied(documentId: string, transferEventId: string): Promise<void> {
    const { rows } = await this.db.query(`
      UPDATE compliance_documents
      SET topology_application_status = 'APPLIED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND transfer_event_id = $2
      RETURNING id
    `, [documentId, transferEventId]);
    if (!rows.length) throw new Error('Topology result does not match a signed document and transfer');
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
        AND (transfer_event_id IS NULL OR transfer_event_id = $1)
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
    filters: { statuses?: string[]; requisitionNumbers?: string[] },
    scope: AccessScope,
  ): Promise<ReturnType<typeof mapDbRowToDocument>[]> {
    const conditions: string[] = [];
    const values: (string | string[])[] = [];
    if (filters.statuses?.length) {
      values.push(filters.statuses);
      conditions.push(`status = ANY($${values.length})`);
    }
    if (filters.requisitionNumbers?.length) {
      values.push(filters.requisitionNumbers);
      conditions.push(`requisition_number = ANY($${values.length})`);
    }
    if (scope.kind === 'organization') {
      values.push(scope.orgId);
      conditions.push(`EXISTS (
        SELECT 1 FROM compliance_transfer_participants p
        WHERE p.requisition_number = compliance_documents.requisition_number
          AND p.transfer_event_id = compliance_documents.transfer_event_id
          AND (p.sender_org_id = $${values.length} OR p.receiver_org_id = $${values.length})
      )`);
    }
    const query = `
      SELECT ${documentSelection}
      FROM compliance_documents
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC;
    `;
    const { rows } = await (values.length ? this.db.query(query, values) : this.db.query(query));
    return rows.map((row) => mapDbRowToDocument(this.normalizeRow(row)));
  }

  async findById(id: string, scope: AccessScope): Promise<ReturnType<typeof mapDbRowToDocument> | null> {
    const query = `
      SELECT ${documentSelection}
      FROM compliance_documents
      WHERE id = $1
      ${scope.kind === 'organization' ? `AND EXISTS (
        SELECT 1 FROM compliance_transfer_participants p
        WHERE p.requisition_number = compliance_documents.requisition_number
          AND p.transfer_event_id = compliance_documents.transfer_event_id
          AND (p.sender_org_id = $2 OR p.receiver_org_id = $2)
      )` : ''};
    `;
    const { rows } = await this.db.query(query, scope.kind === 'organization' ? [id, scope.orgId] : [id]);
    if (rows.length === 0) return null;

    return mapDbRowToDocument(this.normalizeRow(rows[0]));
  }

  async recordTransferParticipants(data: {
    requisitionNumber: string;
    transferEventId: string;
    senderOrgId: string;
    receiverOrgId: string;
  }): Promise<void> {
    const { rows } = await this.db.query(`
      INSERT INTO compliance_transfer_participants
        (requisition_number, transfer_event_id, sender_org_id, receiver_org_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (requisition_number) DO UPDATE SET
        transfer_event_id = EXCLUDED.transfer_event_id
      WHERE compliance_transfer_participants.transfer_event_id = EXCLUDED.transfer_event_id
        AND compliance_transfer_participants.sender_org_id = EXCLUDED.sender_org_id
        AND compliance_transfer_participants.receiver_org_id = EXCLUDED.receiver_org_id
      RETURNING requisition_number;
    `, [data.requisitionNumber, data.transferEventId, data.senderOrgId, data.receiverOrgId]);
    if (!rows.length) throw new Error('Conflicting transfer participant metadata');
  }

  async findTransferParticipants(transferEventId: string, requisitionNumber: string): Promise<{
    senderOrgId: string;
    receiverOrgId: string;
  } | null> {
    const { rows } = await this.db.query<{ sender_org_id: string; receiver_org_id: string }>(`
      SELECT sender_org_id, receiver_org_id
      FROM compliance_transfer_participants
      WHERE transfer_event_id = $1 AND requisition_number = $2
    `, [transferEventId, requisitionNumber]);
    return rows[0] ? { senderOrgId: rows[0].sender_org_id, receiverOrgId: rows[0].receiver_org_id } : null;
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