// File: services/core/compliance-service/server/src/services/signing/coordinator/signing-coordinator.integration.test.ts
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { EventBroker } from '@shared/messaging';
import { DocumentsRepository, SignedOutboxRepository, SigningOperationsRepository } from '../../../repositories';
import { NatsSigningCoordinator } from './nats-signing-coordinator';
import { SignedOutboxService } from '../outbox';

const connectionString = process.env.COMPLIANCE_TEST_DATABASE_URL;

describe('signing reconciliation with PostgreSQL', () => {
  let pool: Pool;

  beforeAll(async () => {
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
      CREATE TEMP TABLE compliance_signed_outbox (
        event_id text PRIMARY KEY, document_id uuid NOT NULL, subject text NOT NULL, payload jsonb NOT NULL,
        published_at timestamptz, lease_id uuid, lease_until timestamptz,
        next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE compliance_transfer_participants (
        requisition_number text PRIMARY KEY, transfer_event_id uuid UNIQUE NOT NULL,
        sender_org_id text NOT NULL, receiver_org_id text NOT NULL
      )
    `);
  });

  afterAll(async () => { await pool?.end(); });

  it('replays an ambiguous publication with the same event without signing twice', async () => {
    const documentId = randomUUID();
    const transferEventId = randomUUID();
    const claim = {
      documentId, draftHash: 'a'.repeat(64), creatorId: 'creator', templateId: 'asset-transfer-authorization',
      storageBucket: 'bucket', storageKey: 'draft', signerOrgId: 'sender',
      senderOrgId: 'sender', receiverOrgId: 'receiver', requisitionNumber: 'REQ-REPLAY',
      transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const, assetIds: ['asset'],
    };
    const command = {
      documentId, documentName: claim.templateId, documentType: claim.operation, signerId: 'signer',
      requisitionNumber: claim.requisitionNumber, storageBucket: 'bucket', storageKey: 'draft',
      fileHash: claim.draftHash, signatureImageBase64: 'signature',
    };
    const signed = {
      success: true, storageBucket: 'bucket', storageKey: 'signed', fileHash: 'b'.repeat(64),
      presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    };
    const broker = new EventBroker('nats://localhost:4222');
    broker.request = vi.fn().mockResolvedValue(signed);
    const events: unknown[] = [];
    broker.publish = vi.fn().mockImplementation(async (_subject, event) => {
      events.push(structuredClone(event));
      if (events.length === 1) throw new Error('acknowledgement lost');
    });
    const topology = { reserve: vi.fn().mockResolvedValue({ transferEventId }) };
    const operations = new SigningOperationsRepository(pool);
    const documents = new DocumentsRepository(pool);
    const outbox = new SignedOutboxRepository(pool);
    const coordinator = new NatsSigningCoordinator(operations, topology, broker, outbox);
    const publisher = new SignedOutboxService(outbox, broker);
    await operations.enqueue(claim, command);

    await expect(coordinator.processNext(documentId)).resolves.toBe(true);
    expect(await operations.find(documentId)).toMatchObject({ state: 'COMPLETED', command: null });
    await expect(publisher.publishNext()).rejects.toThrow('acknowledgement lost');
    await pool.query('UPDATE compliance_signed_outbox SET next_attempt_at = now() WHERE document_id = $1', [documentId]);
    await expect(publisher.publishNext()).resolves.toBe(true);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(events[1]);
    expect(broker.request).toHaveBeenCalledOnce();
    expect(topology.reserve).toHaveBeenCalledOnce();
    expect(await operations.find(documentId)).toMatchObject({ state: 'COMPLETED', command: null });
    expect(await documents.findById(documentId, { kind: 'organization', orgId: 'sender' })).not.toBeNull();
    expect(await documents.findById(documentId, { kind: 'organization', orgId: 'receiver' })).not.toBeNull();
    expect(await documents.findById(documentId, { kind: 'organization', orgId: 'other' })).toBeNull();
  });
});
