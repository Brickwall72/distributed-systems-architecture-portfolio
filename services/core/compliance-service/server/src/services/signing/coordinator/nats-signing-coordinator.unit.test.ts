// File: services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.unit.test.ts
import type { SigningOperation } from '../../../repositories';
import { NatsSigningCoordinator } from './nats-signing-coordinator';
import { TopologyConflict } from '../../../messaging/topology';

describe('NatsSigningCoordinator', () => {
  const documentId = '00000000-0000-4000-8000-000000000001';
  const transferEventId = '00000000-0000-4000-8000-000000000002';
  const claim = {
    documentId, draftHash: 'a'.repeat(64), creatorId: 'creator', templateId: 'asset-transfer-authorization',
    storageBucket: 'bucket', storageKey: 'draft', signerOrgId: 'sender', senderOrgId: 'sender', receiverOrgId: 'receiver',
    requisitionNumber: 'req', transferType: 'PHYSICAL_TRANSFER' as const, operation: 'AUTHORIZATION' as const, assetIds: ['asset'],
  };
  const command = {
    documentId, documentName: claim.templateId, documentType: claim.operation, signerId: 'signer',
    requisitionNumber: 'req', storageBucket: 'bucket', storageKey: 'draft',
    fileHash: claim.draftHash, signatureImageBase64: 'signature',
  };
  const signedResult = {
    success: true, storageBucket: 'bucket', storageKey: 'signed', fileHash: 'b'.repeat(64),
    presignedUrl: 'http://localhost:9000/bucket/signed', signedAt: '2026-01-01T00:00:00.000Z',
    uploadedAt: '2026-01-01T00:00:00.000Z',
  };
  const operation: SigningOperation = {
    claim, command, state: 'PENDING', signedResult: null, leaseId: '00000000-0000-4000-8000-000000000003',
  };
  const setup = (item: SigningOperation = operation) => {
    const operations = { claimNext: vi.fn().mockResolvedValue(item), saveSigned: vi.fn(), defer: vi.fn() };
    const topology = { reserve: vi.fn().mockResolvedValue({ transferEventId }) };
    const broker = { request: vi.fn().mockResolvedValue(signedResult) };
    const outbox = { finalize: vi.fn() };
    return { operations, topology, broker, outbox, service: new NatsSigningCoordinator(operations, topology, broker, outbox) };
  };

  it('reserves, signs, persists the result, and finalizes without waiting for topology commit', async () => {
    const { operations, topology, broker, outbox, service } = setup();
    expect(await service.processNext(documentId)).toBe(true);
    expect(topology.reserve).toHaveBeenCalledWith(claim);
    expect(broker.request).toHaveBeenCalledOnce();
    expect(operations.saveSigned).toHaveBeenCalledWith(operation, signedResult);
    expect(outbox.finalize).toHaveBeenCalledWith(operation, transferEventId);
    expect(operations.saveSigned.mock.invocationCallOrder[0]).toBeLessThan(outbox.finalize.mock.invocationCallOrder[0]);
  });

  it('recovers signed work without issuing a second signing request', async () => {
    const signedOperation: SigningOperation = { ...operation, state: 'SIGNED', signedResult };
    const { broker, topology, outbox, service } = setup(signedOperation);
    await service.processNext(documentId);
    expect(topology.reserve).toHaveBeenCalledOnce();
    expect(broker.request).not.toHaveBeenCalled();
    expect(outbox.finalize).toHaveBeenCalledWith(signedOperation, transferEventId);
  });

  it('does not sign after a reservation conflict', async () => {
    const { operations, topology, broker, service } = setup();
    topology.reserve.mockRejectedValue(new TopologyConflict('unavailable'));
    await expect(service.processNext()).rejects.toBeInstanceOf(TopologyConflict);
    expect(broker.request).not.toHaveBeenCalled();
    expect(operations.defer).toHaveBeenCalledWith(operation, 'TRANSFER_CONFLICT', true);
  });

  it('retains the reservation after an uncertain signing outcome', async () => {
    const { operations, broker, outbox, service } = setup();
    broker.request.mockRejectedValue(new Error('timeout'));
    await expect(service.processNext()).rejects.toThrow('timeout');
    expect(operations.defer).toHaveBeenCalledWith(operation, 'RETRY', false);
    expect(outbox.finalize).not.toHaveBeenCalled();
  });
});
