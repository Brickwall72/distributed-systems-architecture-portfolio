// File: services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  COMPLIANCE_EVENT_SUBJECTS, COMPLIANCE_EVENT_TYPES,
  transferInitiatedEventSchema, TransferReceivedEventSchema,
} from '@contracts/compliance';
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, TOPOLOGY_SIGNED_EVENT_TYPE, signedTransferEventSchema } from '@contracts/topology';
import { signingOperationSchema, type SigningOperation } from './signing-operations.repository';

const outboxItemSchema = z.object({
  eventId: z.string().min(1),
  subject: z.string().min(1),
  payload: z.unknown(),
  leaseId: z.string().uuid(),
});
export type SignedOutboxItem = z.infer<typeof outboxItemSchema>;

export class SignedOutboxRepository {
  constructor(private readonly db: Pool) {}

  async finalize(operation: SigningOperation, transferEventId: string): Promise<void> {
    const parsedId = z.string().uuid().parse(transferEventId);
    if (!operation.leaseId) throw new Error('Signing operation has no lease');
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`
        SELECT * FROM compliance_signing_operations
        WHERE document_id = $1 AND lease_id = $2 AND state = 'SIGNED'
        FOR UPDATE
      `, [operation.claim.documentId, operation.leaseId]);
      if (!rows.length) throw new Error('Signing operation lease was lost or state changed');
      const current = signingOperationSchema.parse({
        claim: rows[0].claim, command: rows[0].command, state: rows[0].state,
        signedResult: rows[0].signed_result, leaseId: rows[0].lease_id,
      });
      const { claim, command, signedResult } = current;
      if (!command?.signerId || !signedResult?.success) throw new Error('Signed operation has no successful result or signer');
      if (claim.transferEventId && claim.transferEventId !== parsedId) throw new Error('Reserved transfer does not match receipt');

      const document = await client.query(`
        INSERT INTO compliance_documents (
          id, name, type, transfer_type, requisition_number, storage_bucket, storage_key,
          status, signer_id, file_hash, transfer_event_id, topology_application_status, topology_pending_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SIGNED', $8, $9, $10, 'PENDING', now())
        ON CONFLICT (id) DO UPDATE SET id = compliance_documents.id
        WHERE compliance_documents.name = EXCLUDED.name AND compliance_documents.type = EXCLUDED.type
          AND compliance_documents.transfer_type = EXCLUDED.transfer_type
          AND compliance_documents.requisition_number = EXCLUDED.requisition_number
          AND compliance_documents.storage_bucket = EXCLUDED.storage_bucket
          AND compliance_documents.storage_key = EXCLUDED.storage_key
          AND compliance_documents.signer_id = EXCLUDED.signer_id
          AND compliance_documents.file_hash = EXCLUDED.file_hash
          AND compliance_documents.transfer_event_id = EXCLUDED.transfer_event_id
        RETURNING id
      `, [
        claim.documentId, claim.templateId, claim.operation, claim.transferType, claim.requisitionNumber,
        signedResult.storageBucket, signedResult.storageKey, command.signerId, signedResult.fileHash, parsedId,
      ]);
      if (!document.rows.length) throw new Error('Conflicting document metadata');

      const participants = await client.query(`
        INSERT INTO compliance_transfer_participants (requisition_number, transfer_event_id, sender_org_id, receiver_org_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (requisition_number) DO UPDATE SET transfer_event_id = EXCLUDED.transfer_event_id
        WHERE compliance_transfer_participants.transfer_event_id = EXCLUDED.transfer_event_id
          AND compliance_transfer_participants.sender_org_id = EXCLUDED.sender_org_id
          AND compliance_transfer_participants.receiver_org_id = EXCLUDED.receiver_org_id
        RETURNING requisition_number
      `, [claim.requisitionNumber, parsedId, claim.senderOrgId, claim.receiverOrgId]);
      if (!participants.rows.length) throw new Error('Conflicting transfer participant metadata');

      const base = {
        specversion: '1.0', source: 'service:compliance-server', time: signedResult.signedAt,
        datacontenttype: 'application/json', correlationId: `claim_${claim.documentId}`,
      };
      const signedId = `evt_compliance_signed_${claim.documentId}`;
      const signedEvent = signedTransferEventSchema.parse({
        ...base, id: signedId, type: TOPOLOGY_SIGNED_EVENT_TYPE,
        data: { documentId: claim.documentId, transferEventId: parsedId, draftHash: claim.draftHash, signedFileHash: signedResult.fileHash },
      });
      const publicId = `evt_compliance_${claim.documentId}`;
      const documentData = {
        documentId: claim.documentId, documentName: claim.templateId, documentType: claim.operation,
        fileHash: signedResult.fileHash, signerId: command.signerId, signedAt: signedResult.signedAt,
        assetIds: claim.assetIds, requisitionNumber: claim.requisitionNumber,
      };
      const publicEvent = claim.operation === 'AUTHORIZATION'
        ? transferInitiatedEventSchema.parse({
          ...base, id: publicId, type: COMPLIANCE_EVENT_TYPES.TRANSFER_INITIATED,
          data: { ...documentData, date: signedResult.signedAt, transferType: claim.transferType,
            senderOrgId: claim.senderOrgId, receiverOrgId: claim.receiverOrgId },
        })
        : TransferReceivedEventSchema.parse({
          ...base, id: publicId, type: COMPLIANCE_EVENT_TYPES.TRANSFER_RECEIVED,
          data: { ...documentData, transferEventId: parsedId },
        });
      const outboxEvents = [
        [signedId, TOPOLOGY_SIGNED_EVENT_SUBJECT, signedEvent],
        [publicId, claim.operation === 'AUTHORIZATION' ? COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED : COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED, publicEvent],
      ] as const;
      const inserted = await client.query(`
          INSERT INTO compliance_signed_outbox (event_id, document_id, subject, payload)
          VALUES ($1, $2, $3, $4::jsonb), ($5, $6, $7, $8::jsonb)
          ON CONFLICT (event_id) DO UPDATE SET event_id = compliance_signed_outbox.event_id
          WHERE compliance_signed_outbox.document_id = EXCLUDED.document_id
            AND compliance_signed_outbox.subject = EXCLUDED.subject AND compliance_signed_outbox.payload = EXCLUDED.payload
          RETURNING event_id
        `, [
        outboxEvents[0][0], claim.documentId, outboxEvents[0][1], JSON.stringify(outboxEvents[0][2]),
        outboxEvents[1][0], claim.documentId, outboxEvents[1][1], JSON.stringify(outboxEvents[1][2]),
      ]);
      if (inserted.rows.length !== outboxEvents.length) throw new Error('Conflicting signed outbox event');

      await client.query(`
        UPDATE compliance_signing_operations
        SET state = 'COMPLETED', command = NULL, lease_id = NULL, lease_until = NULL,
          last_error_code = NULL, updated_at = now()
        WHERE document_id = $1 AND lease_id = $2 AND state = 'SIGNED'
      `, [claim.documentId, operation.leaseId]);
      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimNext(): Promise<SignedOutboxItem | null> {
    const leaseId = randomUUID();
    const { rows } = await this.db.query(`
      WITH candidate AS (
        SELECT event_id FROM compliance_signed_outbox
        WHERE published_at IS NULL AND next_attempt_at <= now()
          AND (lease_until IS NULL OR lease_until <= now())
        ORDER BY created_at, event_id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE compliance_signed_outbox AS item
      SET lease_id = $1, lease_until = now() + interval '45 seconds'
      FROM candidate WHERE item.event_id = candidate.event_id
      RETURNING item.*
    `, [leaseId]);
    return rows[0] ? outboxItemSchema.parse({
      eventId: rows[0].event_id, subject: rows[0].subject, payload: rows[0].payload, leaseId: rows[0].lease_id,
    }) : null;
  }

  async flagStalled(): Promise<void> {
    await this.db.query(`
      UPDATE compliance_documents
      SET topology_application_status = 'ATTENTION_REQUIRED', updated_at = now()
      WHERE topology_application_status = 'PENDING'
        AND topology_pending_at <= now() - interval '5 minutes'
    `);
  }

  async markPublished(item: SignedOutboxItem): Promise<void> {
    const { rows } = await this.db.query(`
      UPDATE compliance_signed_outbox SET published_at = now(), lease_id = NULL, lease_until = NULL, last_error = NULL
      WHERE event_id = $1 AND lease_id = $2 AND published_at IS NULL RETURNING event_id
    `, [item.eventId, item.leaseId]);
    if (!rows.length) throw new Error('Signed outbox lease was lost or event was already published');
  }

  async defer(item: SignedOutboxItem, reason: string): Promise<void> {
    const { rows } = await this.db.query(`
      WITH failed AS (
        UPDATE compliance_signed_outbox SET lease_id = NULL, lease_until = NULL,
          next_attempt_at = now() + interval '5 seconds', last_error = $3
        WHERE event_id = $1 AND lease_id = $2 AND published_at IS NULL
        RETURNING event_id, document_id
      ), flagged AS (
        UPDATE compliance_documents AS document
        SET topology_application_status = 'ATTENTION_REQUIRED', updated_at = now()
        FROM failed
        WHERE document.id = failed.document_id AND document.topology_application_status = 'PENDING'
        RETURNING document.id
      )
      SELECT event_id FROM failed
    `, [item.eventId, item.leaseId, reason]);
    if (!rows.length) throw new Error('Signed outbox lease was lost or event was already published');
  }
}
