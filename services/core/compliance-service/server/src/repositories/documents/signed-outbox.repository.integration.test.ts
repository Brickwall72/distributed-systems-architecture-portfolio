// File: services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.integration.test.ts
// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, signedTransferEventSchema } from '@contracts/topology';
import { COMPLIANCE_EVENT_SUBJECTS, transferInitiatedEventSchema } from '@contracts/compliance';
import { SignedOutboxRepository, SigningOperationsRepository } from './index';

describe('durable signed-document outbox', () => {
  let pool: Pool;
  const documentId = randomUUID();
  const transferEventId = randomUUID();
  const claim = {
    documentId, draftHash: 'a'.repeat(64), creatorId: 'creator', templateId: 'asset-transfer-authorization',
    storageBucket: 'bucket', storageKey: 'draft', signerOrgId: 'sender',
    senderOrgId: 'sender', receiverOrgId: 'receiver', requisitionNumber: 'REQ-OUTBOX',
    transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const, assetIds: ['asset'],
  };
  const command = {
    documentId, documentName: claim.templateId, documentType: claim.operation, signerId: 'signer',
    requisitionNumber: claim.requisitionNumber, storageBucket: 'bucket', storageKey: 'draft',
    fileHash: claim.draftHash, signatureImageBase64: 'signature',
  };
  const signedResult = {
    success: true, storageBucket: 'bucket', storageKey: 'signed', fileHash: 'b'.repeat(64),
    presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
    uploadedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    const connectionString = process.env.COMPLIANCE_TEST_DATABASE_URL;
    if (!connectionString) throw new Error('COMPLIANCE_TEST_DATABASE_URL must point to an isolated test database');
    pool = new Pool({ connectionString, max: 1 });
    await pool.query(`
      CREATE TEMP TABLE compliance_signing_operations (
        document_id uuid PRIMARY KEY, request_hash text NOT NULL, claim jsonb NOT NULL,
        command jsonb, state text NOT NULL, signed_result jsonb, lease_id uuid, lease_until timestamptz,
        next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error_code text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE compliance_documents (
        id uuid PRIMARY KEY, name text NOT NULL, type text NOT NULL, transfer_type text NOT NULL,
        requisition_number text NOT NULL, storage_bucket text NOT NULL, storage_key text NOT NULL,
        status text NOT NULL, signer_id text NOT NULL, file_hash text NOT NULL, transfer_event_id uuid,
        topology_application_status text NOT NULL DEFAULT 'APPLIED', topology_pending_at timestamptz,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE compliance_transfer_participants (
        requisition_number text PRIMARY KEY, transfer_event_id uuid UNIQUE NOT NULL,
        sender_org_id text NOT NULL, receiver_org_id text NOT NULL
      );
      CREATE TEMP TABLE compliance_signed_outbox (
        event_id text PRIMARY KEY, document_id uuid NOT NULL, subject text NOT NULL, payload jsonb NOT NULL,
        published_at timestamptz, lease_id uuid, lease_until timestamptz,
        next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  });

  afterAll(async () => { await pool?.end(); });

  it('atomically records the signed document, participants and publish intents', async () => {
    const operations = new SigningOperationsRepository(pool);
    const outbox = new SignedOutboxRepository(pool);
    await operations.enqueue(claim, command);
    const operation = await operations.claimNext(documentId);
    if (!operation) throw new Error('Expected leased signing operation');
    await operations.saveSigned(operation, signedResult);

    await outbox.finalize(operation, transferEventId);
    expect(await operations.find(documentId)).toMatchObject({ state: 'COMPLETED', command: null });
    expect((await pool.query('SELECT transfer_event_id, status, topology_application_status FROM compliance_documents WHERE id = $1', [documentId])).rows[0])
      .toEqual({ transfer_event_id: transferEventId, status: 'SIGNED', topology_application_status: 'PENDING' });
    expect((await pool.query('SELECT receiver_org_id FROM compliance_transfer_participants WHERE requisition_number = $1', [claim.requisitionNumber])).rows[0])
      .toEqual({ receiver_org_id: 'receiver' });

    const events = await pool.query('SELECT subject, payload FROM compliance_signed_outbox ORDER BY subject');
    expect(events.rows).toHaveLength(2);
    const signed = events.rows.find((row) => row.subject === TOPOLOGY_SIGNED_EVENT_SUBJECT);
    const published = events.rows.find((row) => row.subject === COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED);
    expect(signedTransferEventSchema.parse(signed?.payload).data).toMatchObject({ documentId, transferEventId });
    expect(transferInitiatedEventSchema.parse(published?.payload).data).toMatchObject({ documentId, assetIds: ['asset'] });
    expect(JSON.stringify(events.rows)).not.toContain('signatureImageBase64');

    const item = await outbox.claimNext();
    if (!item) throw new Error('Expected outbox event');
    await outbox.defer(item, 'broker unavailable');
    expect((await pool.query('SELECT topology_application_status FROM compliance_documents WHERE id = $1', [documentId])).rows[0])
      .toEqual({ topology_application_status: 'ATTENTION_REQUIRED' });
    await pool.query('UPDATE compliance_signed_outbox SET next_attempt_at = now() WHERE event_id = $1', [item.eventId]);
    const retry = await outbox.claimNext();
    if (!retry) throw new Error('Expected retried outbox event');
    expect(retry.eventId).toBe(item.eventId);
    expect(retry.payload).toEqual(item.payload);
    await expect(outbox.markPublished(item)).rejects.toThrow('lease was lost');
    await outbox.markPublished(retry);
  });

  it('flags stalled topology application without releasing its reservation', async () => {
    const outbox = new SignedOutboxRepository(pool);
    await pool.query(`UPDATE compliance_documents SET topology_application_status = 'PENDING',
      topology_pending_at = now() - interval '6 minutes' WHERE id = $1`, [documentId]);
    await outbox.flagStalled();
    expect((await pool.query('SELECT topology_application_status FROM compliance_documents WHERE id = $1', [documentId])).rows[0])
      .toEqual({ topology_application_status: 'ATTENTION_REQUIRED' });
  });

  it('rolls back the document if participant data conflicts', async () => {
    const operations = new SigningOperationsRepository(pool);
    const outbox = new SignedOutboxRepository(pool);
    const id = randomUUID();
    await operations.enqueue({ ...claim, documentId: id }, { ...command, documentId: id });
    const operation = await operations.claimNext(id);
    if (!operation) throw new Error('Expected leased signing operation');
    await operations.saveSigned(operation, signedResult);
    await expect(outbox.finalize(operation, randomUUID())).rejects.toThrow('Conflicting transfer participant metadata');
    expect((await pool.query('SELECT id FROM compliance_documents WHERE id = $1', [id])).rows).toHaveLength(0);
    expect((await pool.query('SELECT event_id FROM compliance_signed_outbox WHERE document_id = $1', [id])).rows).toHaveLength(0);
    expect(await operations.find(id)).toMatchObject({ state: 'SIGNED' });
  });
});
