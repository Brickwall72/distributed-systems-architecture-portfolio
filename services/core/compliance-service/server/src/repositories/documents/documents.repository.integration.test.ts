// File: services/core/compliance-service/server/src/repositories/documents/documents.repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DocumentsRepository } from './documents.repository';

const connectionString = process.env.COMPLIANCE_TEST_DATABASE_URL;

describe('DocumentsRepository participant access with PostgreSQL', () => {
  let pool: Pool;
  let repository: DocumentsRepository;
  const transferId = randomUUID();
  const documentId = randomUUID();
  const unrelatedId = randomUUID();

  beforeAll(async () => {
    if (!connectionString) throw new Error('COMPLIANCE_TEST_DATABASE_URL must point to an isolated test database');
    pool = new Pool({ connectionString, max: 1 });
    await pool.query(`
      CREATE TEMP TABLE compliance_documents (
        id uuid PRIMARY KEY, name text NOT NULL, type text NOT NULL, transfer_type text NOT NULL,
        requisition_number text NOT NULL, storage_bucket text NOT NULL, storage_key text NOT NULL,
        status text NOT NULL, signer_id text NOT NULL, file_hash text NOT NULL, transfer_event_id uuid,
        topology_application_status text NOT NULL DEFAULT 'APPLIED', topology_pending_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE compliance_transfer_participants (
        requisition_number text PRIMARY KEY, transfer_event_id uuid UNIQUE NOT NULL,
        sender_org_id text NOT NULL, receiver_org_id text NOT NULL
      );
      CREATE TEMP TABLE compliance_draft_bindings (
        document_id uuid PRIMARY KEY, creator_id text NOT NULL, creator_org_id text NOT NULL,
        binding jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE compliance_signed_outbox (
        document_id uuid NOT NULL, published_at timestamptz, last_error text
      );
    `);
    repository = new DocumentsRepository(pool);
    await pool.query(`
      INSERT INTO compliance_documents
        (id, name, type, transfer_type, requisition_number, storage_bucket, storage_key, status, signer_id, file_hash, transfer_event_id)
      VALUES
        ($1, 'asset-transfer-authorization', 'AUTHORIZATION', 'PHYSICAL_TRANSFER', 'REQ-1', 'bucket', 'key', 'SIGNED', 'signer', 'hash', $2),
        ($3, 'asset-transfer-receipt', 'RECEIPT', 'PHYSICAL_TRANSFER', 'REQ-1', 'bucket', 'other', 'SIGNED', 'signer', 'hash', $4)
    `, [documentId, transferId, unrelatedId, randomUUID()]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('hides incomplete metadata, then grants only matching transfer participants', async () => {
    const sender = { kind: 'organization', orgId: 'sender' } as const;
    const receiver = { kind: 'organization', orgId: 'receiver' } as const;
    const outsider = { kind: 'organization', orgId: 'outsider' } as const;
    expect(await repository.findAll({}, sender)).toEqual([]);
    await repository.recordTransferParticipants({
      requisitionNumber: 'REQ-1', transferEventId: transferId,
      senderOrgId: 'sender', receiverOrgId: 'receiver',
    });
    expect(await repository.findTransferParticipants(transferId, 'REQ-1'))
      .toEqual({ senderOrgId: 'sender', receiverOrgId: 'receiver' });
    expect(await repository.findTransferParticipants(transferId, 'WRONG')).toBeNull();
    expect((await repository.findAll({}, sender)).map((doc) => doc.id)).toEqual([documentId]);
    expect((await repository.findAll({}, receiver)).map((doc) => doc.id)).toEqual([documentId]);
    expect(await repository.findById(documentId, outsider)).toBeNull();
    expect(await repository.findById(unrelatedId, sender)).toBeNull();
    expect(await repository.findAll({}, { kind: 'auditor' })).toHaveLength(2);
  });

  it('accepts idempotent participant events and rejects ownership substitution', async () => {
    const data = {
      requisitionNumber: 'REQ-1', transferEventId: transferId,
      senderOrgId: 'sender', receiverOrgId: 'receiver',
    };
    await expect(repository.recordTransferParticipants(data)).resolves.toBeUndefined();
    await expect(repository.recordTransferParticipants({ ...data, receiverOrgId: 'outsider' }))
      .rejects.toThrow('Conflicting transfer participant metadata');
    expect(await repository.findById(documentId, { kind: 'organization', orgId: 'outsider' })).toBeNull();
  });

  it('prevents document replays and unrelated transfer updates from changing indexed facts', async () => {
    const data = {
      documentId, documentName: 'asset-transfer-authorization' as const,
      documentType: 'AUTHORIZATION' as const, transferType: 'PHYSICAL_TRANSFER' as const,
      requisitionNumber: 'REQ-1', storageBucket: 'bucket', storageKey: 'key',
      status: 'SIGNED' as const, signerId: 'signer', fileHash: 'hash',
    };
    await repository.updateForReqNumber({ requisitionNumber: 'REQ-1', transferEventId: transferId, status: 'COMPLETED' });
    expect((await repository.insert(data)).status).toBe('COMPLETED');
    await expect(repository.insert({ ...data, storageKey: 'substituted' })).rejects.toThrow('Conflicting document metadata');
    await repository.updateForReqNumber({ requisitionNumber: 'REQ-1', transferEventId: randomUUID(), status: 'IN_PROGRESS' });
    const document = await repository.findById(documentId, { kind: 'auditor' });
    expect(document).toMatchObject({ storageKey: 'key', transferEventId: transferId, status: 'COMPLETED' });
  });

  it('only applies topology results to the matching transfer and exposes failed delivery', async () => {
    await pool.query(`UPDATE compliance_documents SET topology_application_status = 'PENDING' WHERE id = $1`, [documentId]);
    await expect(repository.markTopologyApplied(documentId, randomUUID())).rejects.toThrow('does not match');
    expect((await repository.findById(documentId, { kind: 'auditor' }))?.topologyApplicationStatus).toBe('PENDING');
    await repository.markTopologyApplied(documentId, transferId);
    await pool.query(`INSERT INTO compliance_signed_outbox (document_id, last_error) VALUES ($1, 'broker unavailable')`, [documentId]);
    expect((await repository.findById(documentId, { kind: 'auditor' }))?.topologyApplicationStatus).toBe('ATTENTION_REQUIRED');
    await pool.query(`UPDATE compliance_signed_outbox SET published_at = now() WHERE document_id = $1`, [documentId]);
    expect((await repository.findById(documentId, { kind: 'auditor' }))?.topologyApplicationStatus).toBe('APPLIED');
  });

  it('stores the draft binding for the originating identity and organization only', async () => {
    const binding = {
      documentId, documentName: 'asset-transfer-authorization' as const,
      documentType: 'AUTHORIZATION' as const, transferType: 'PHYSICAL_TRANSFER' as const,
      requisitionNumber: 'REQ-1', storageBucket: 'bucket', storageKey: 'key',
      fileHash: 'a'.repeat(64), senderOrgId: 'sender', receiverOrgId: 'receiver',
      assetIds: ['asset-a', 'asset-b'],
    };
    await repository.saveDraftBinding(binding, 'creator', 'sender');
    expect(await repository.findDraftBinding(documentId, 'creator', 'sender')).toEqual(binding);
    expect(await repository.findDraftBinding(documentId, 'other', 'sender')).toBeNull();
    expect(await repository.findDraftBinding(documentId, 'creator', 'receiver')).toBeNull();
    await expect(repository.saveDraftBinding({ ...binding, storageKey: 'other' }, 'creator', 'sender')).rejects.toThrow();
  });
});
