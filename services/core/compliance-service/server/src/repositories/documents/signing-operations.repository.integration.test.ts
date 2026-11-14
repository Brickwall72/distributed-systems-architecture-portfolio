// File: services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { SigningOperationsRepository, SigningRequestConflict } from './signing-operations.repository';

const connectionString = process.env.COMPLIANCE_TEST_DATABASE_URL;

describe('durable signing operations with PostgreSQL', () => {
  let pool: Pool;
  let repository: SigningOperationsRepository;
  const documentId = randomUUID();
  const claim = {
    documentId, draftHash: 'a'.repeat(64), creatorId: 'creator', templateId: 'template',
    storageBucket: 'bucket', storageKey: 'draft', signerOrgId: 'sender',
    senderOrgId: 'sender', receiverOrgId: 'receiver', requisitionNumber: 'req',
    transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const, assetIds: ['asset'],
  };
  const command = {
    documentId, documentName: 'template', documentType: 'AUTHORIZATION',
    requisitionNumber: 'req', storageBucket: 'bucket', storageKey: 'draft',
    fileHash: 'a'.repeat(64), signatureImageBase64: 'signature',
  };
  const signedResult = {
    success: true, storageBucket: 'bucket', storageKey: 'signed', fileHash: 'b'.repeat(64),
    presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
    uploadedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    if (!connectionString) throw new Error('COMPLIANCE_TEST_DATABASE_URL must point to an isolated test database');
    pool = new Pool({ connectionString, max: 1 });
    await pool.query(`
      CREATE TEMP TABLE compliance_signing_operations (
        document_id uuid PRIMARY KEY, request_hash text NOT NULL, claim jsonb NOT NULL,
        command jsonb, state text NOT NULL, signed_result jsonb, lease_id uuid, lease_until timestamptz,
        next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error_code text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    repository = new SigningOperationsRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('binds retries to one request and recovers signed work after a lease expires', async () => {
    expect((await repository.enqueue(claim, command)).state).toBe('PENDING');
    expect((await repository.enqueue(claim, command)).state).toBe('PENDING');
    await expect(repository.enqueue(claim, { ...command, signatureImageBase64: 'different' }))
      .rejects.toBeInstanceOf(SigningRequestConflict);
    await expect(repository.enqueue(claim, { ...command, storageKey: 'other' }))
      .rejects.toBeInstanceOf(SigningRequestConflict);
    const [first, competing] = await Promise.all([repository.claimNext(documentId), repository.claimNext(documentId)]);
    expect(first?.state).toBe('PENDING');
    expect(competing).toBeNull();
    if (!first) throw new Error('Expected a leased operation');
    await repository.saveSigned(first, signedResult);
    await pool.query("UPDATE compliance_signing_operations SET lease_until = now() - interval '1 second' WHERE document_id = $1", [documentId]);
    const recovered = await repository.claimNext(documentId);
    expect(recovered?.state).toBe('SIGNED');
    expect(recovered?.signedResult).toEqual(signedResult);
    if (!recovered) throw new Error('Expected a recovered operation');
    await expect(repository.complete(first)).rejects.toThrow('lease was lost');
    await repository.complete(recovered);
    expect(await repository.find(documentId)).toMatchObject({ state: 'COMPLETED', command: null, signedResult });
  });

  it('removes the signature image after a pre-signing conflict', async () => {
    const conflictingId = randomUUID();
    await repository.enqueue({ ...claim, documentId: conflictingId }, { ...command, documentId: conflictingId });
    const operation = await repository.claimNext(conflictingId);
    if (!operation) throw new Error('Expected a leased operation');
    await repository.defer(operation, 'TRANSFER_CONFLICT', true);
    expect(await repository.find(conflictingId)).toMatchObject({ state: 'CONFLICT', command: null });
  });
});
