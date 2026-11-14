// File: services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts
import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { transferClaimSchema, type TransferClaim } from '@contracts/topology';
import { SignDocumentCommandSchema, SignDocumentResponseSchema, type SignDocumentCommand, type SignDocumentResponse } from '@contracts/esign';

export const signingStateSchema = z.enum(['PENDING', 'SIGNED', 'COMPLETED', 'CONFLICT']);
export type SigningState = z.infer<typeof signingStateSchema>;

export class SigningRequestConflict extends Error {}

export const signingOperationSchema = z.object({
  claim: transferClaimSchema,
  command: SignDocumentCommandSchema.nullable(),
  state: signingStateSchema,
  signedResult: SignDocumentResponseSchema.nullable(),
  leaseId: z.string().uuid().nullable(),
});
export type SigningOperation = z.infer<typeof signingOperationSchema>;

function parseOperation(row: Record<string, unknown>): SigningOperation {
  return signingOperationSchema.parse({
    claim: row.claim,
    command: row.command,
    state: row.state,
    signedResult: row.signed_result,
    leaseId: row.lease_id,
  });
}

export class SigningOperationsRepository {
  constructor(private readonly db: Pool) {}

  async enqueue(claimInput: TransferClaim, commandInput: SignDocumentCommand): Promise<SigningOperation> {
    const claim = transferClaimSchema.parse(claimInput);
    const command = SignDocumentCommandSchema.parse(commandInput);
    if (command.documentId !== claim.documentId || command.documentName !== claim.templateId
      || command.documentType !== claim.operation || command.requisitionNumber !== claim.requisitionNumber
      || command.storageBucket !== claim.storageBucket || command.storageKey !== claim.storageKey
      || command.fileHash !== claim.draftHash) {
      throw new SigningRequestConflict('Signing command does not match the topology claim');
    }
    const requestHash = createHash('sha256').update(JSON.stringify({ claim, command })).digest('hex');
    const { rows } = await this.db.query(`
      INSERT INTO compliance_signing_operations (document_id, request_hash, claim, command, state)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, 'PENDING')
      ON CONFLICT (document_id) DO UPDATE SET document_id = compliance_signing_operations.document_id
      WHERE compliance_signing_operations.request_hash = EXCLUDED.request_hash
      RETURNING *
    `, [claim.documentId, requestHash, JSON.stringify(claim), JSON.stringify(command)]);
    if (!rows.length) throw new SigningRequestConflict('A different signing request already exists for this document');
    return parseOperation(rows[0]);
  }

  async find(documentId: string): Promise<SigningOperation | null> {
    const { rows } = await this.db.query('SELECT * FROM compliance_signing_operations WHERE document_id = $1', [documentId]);
    return rows[0] ? parseOperation(rows[0]) : null;
  }

  async claimNext(documentId?: string): Promise<SigningOperation | null> {
    const leaseId = randomUUID();
    const { rows } = await this.db.query(`
      WITH candidate AS (
        SELECT document_id FROM compliance_signing_operations
        WHERE state IN ('PENDING', 'SIGNED') AND next_attempt_at <= now()
          AND (lease_until IS NULL OR lease_until <= now())
          AND ($1::uuid IS NULL OR document_id = $1)
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE compliance_signing_operations AS operation
      SET lease_id = $2, lease_until = now() + interval '45 seconds', updated_at = now()
      FROM candidate WHERE operation.document_id = candidate.document_id
      RETURNING operation.*
    `, [documentId ?? null, leaseId]);
    return rows[0] ? parseOperation(rows[0]) : null;
  }

  async saveSigned(operation: SigningOperation, result: SignDocumentResponse): Promise<void> {
    await this.updateWithLease(`
      UPDATE compliance_signing_operations
      SET state = 'SIGNED', signed_result = $3::jsonb, updated_at = now()
      WHERE document_id = $1 AND lease_id = $2 AND state = 'PENDING'
      RETURNING document_id
    `, operation, JSON.stringify(SignDocumentResponseSchema.parse(result)));
  }

  async complete(operation: SigningOperation): Promise<void> {
    await this.updateWithLease(`
      UPDATE compliance_signing_operations
      SET state = 'COMPLETED', command = NULL, lease_id = NULL, lease_until = NULL,
        last_error_code = NULL, updated_at = now()
      WHERE document_id = $1 AND lease_id = $2 AND state = 'SIGNED'
      RETURNING document_id
    `, operation);
  }

  async defer(operation: SigningOperation, code: string, conflict = false): Promise<void> {
    await this.updateWithLease(`
      UPDATE compliance_signing_operations
      SET state = CASE WHEN $4 AND state = 'PENDING' THEN 'CONFLICT' ELSE state END,
        command = CASE WHEN $4 AND state = 'PENDING' THEN NULL ELSE command END,
        last_error_code = $3, lease_id = NULL, lease_until = NULL,
        next_attempt_at = now() + interval '5 seconds', updated_at = now()
      WHERE document_id = $1 AND lease_id = $2 AND state IN ('PENDING', 'SIGNED')
      RETURNING document_id
    `, operation, code, conflict);
  }

  private async updateWithLease(query: string, operation: SigningOperation, ...extra: unknown[]): Promise<void> {
    if (!operation.leaseId) throw new Error('Signing operation has no lease');
    const { rows } = await this.db.query(query, [operation.claim.documentId, operation.leaseId, ...extra]);
    if (!rows.length) throw new Error('Signing operation lease was lost or state changed');
  }
}
