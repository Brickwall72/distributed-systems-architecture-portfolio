// File: services/core/audit-ledger/server/src/services/ledger.renditions.unit.test.ts
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { overviewRecord } from '../registry';
import { renditionSchema } from '../repositories';
import { LedgerService, type LedgerServiceDeps } from './ledger.service';
import { RENDITION_STATUS, LEDGER_STATUS } from 'audit-shared';

describe('ledger rendition retrieval', () => {
  const auditor = { kind: 'auditor' } as const;
  const record = overviewRecord();
  const ready = mockFromSchema(renditionSchema, {
    sequence: record.sequence, requisitionNumber: record.requisitionNumber, sourceRecordHash: record.recordHash,
    status: 'READY', storageBucket: 'dsap', storageKey: 'audit/file.pdf', fileHash: SHA256_HEX,
  });
  const makeService = (jobs = [ready]) => {
    const findBySequences = vi.fn().mockResolvedValue(jobs);
    const getSignedDownloadUrl = vi.fn().mockResolvedValue('https://storage.example/file.pdf');
    const sealed = { list: vi.fn().mockResolvedValue([record]), findByRequisition: vi.fn().mockResolvedValue(record) };
    const service = new LedgerService({ sealed, renditions: { findBySequences }, getSignedDownloadUrl } as unknown as LedgerServiceDeps);
    return { service, findBySequences, getSignedDownloadUrl, sealed };
  };

  it('looks up statuses in one batch and treats missing jobs as pending', async () => {
    const { service, findBySequences } = makeService([]);
    const result = await service.listTransfers({ status: LEDGER_STATUS.SEALED }, auditor);
    expect(findBySequences).toHaveBeenCalledOnce();
    expect(findBySequences).toHaveBeenCalledWith([record.sequence]);
    expect(result[0].renditionStatus).toBe(RENDITION_STATUS.PENDING);
  });

  it('presigns only matching ready metadata', async () => {
    const { service, getSignedDownloadUrl } = makeService();
    expect(await service.getTransferDocument(record.requisitionNumber, auditor)).toEqual({
      status: 'READY', presignedUrl: 'https://storage.example/file.pdf',
    });
    expect(getSignedDownloadUrl).toHaveBeenCalledWith({ storageBucket: 'dsap', storageKey: 'audit/file.pdf', expiresInSeconds: 600 });
    const pending = makeService([{ ...ready, status: 'FAILED' }]);
    expect(await pending.service.getTransferDocument(record.requisitionNumber, auditor)).toEqual({ status: 'NOT_READY' });
    expect(pending.getSignedDownloadUrl).not.toHaveBeenCalled();
    const invalid = makeService([{ ...ready, sourceRecordHash: 'b'.repeat(64) }]);
    await expect(invalid.service.getTransferDocument(record.requisitionNumber, auditor)).rejects.toThrow('does not match');
  });

  it('does not reveal or presign a nonparticipant transfer', async () => {
    const { service, getSignedDownloadUrl } = makeService();
    const scope = { kind: 'organization', orgId: 'unrelated-org' } as const;
    expect(await service.getSealedTransfer(record.requisitionNumber, scope)).toBeNull();
    expect(await service.verifyTransfer(record.requisitionNumber, scope)).toBeNull();
    expect(await service.getTransferDocument(record.requisitionNumber, scope)).toEqual({ status: 'NOT_FOUND' });
    expect(getSignedDownloadUrl).not.toHaveBeenCalled();
    for (const orgId of [record.sender.id, record.receiver.id]) {
      expect(await service.getSealedTransfer(record.requisitionNumber, { kind: 'organization', orgId })).toEqual(record);
    }
  });
});
