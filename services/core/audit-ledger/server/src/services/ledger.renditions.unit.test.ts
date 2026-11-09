// File: services/core/audit-ledger/server/src/services/ledger.renditions.unit.test.ts
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { overviewRecord } from '../registry/overview.test-support';
import { renditionSchema } from '../repositories/renditions';
import { LedgerService, type LedgerServiceDeps } from './ledger.service';
import { RENDITION_STATUS, LEDGER_STATUS } from 'audit-shared';

describe('ledger rendition retrieval', () => {
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
    const result = await service.listTransfers({ status: LEDGER_STATUS.SEALED });
    expect(findBySequences).toHaveBeenCalledOnce();
    expect(findBySequences).toHaveBeenCalledWith([record.sequence]);
    expect(result[0].renditionStatus).toBe(RENDITION_STATUS.PENDING);
  });

  it('presigns only matching ready metadata', async () => {
    const { service, getSignedDownloadUrl } = makeService();
    expect(await service.getTransferDocument(record.requisitionNumber)).toEqual({
      status: 'READY', presignedUrl: 'https://storage.example/file.pdf',
    });
    expect(getSignedDownloadUrl).toHaveBeenCalledWith({ storageBucket: 'dsap', storageKey: 'audit/file.pdf', expiresInSeconds: 600 });
    const pending = makeService([{ ...ready, status: 'FAILED' }]);
    expect(await pending.service.getTransferDocument(record.requisitionNumber)).toEqual({ status: 'NOT_READY' });
    expect(pending.getSignedDownloadUrl).not.toHaveBeenCalled();
    const invalid = makeService([{ ...ready, sourceRecordHash: 'b'.repeat(64) }]);
    await expect(invalid.service.getTransferDocument(record.requisitionNumber)).rejects.toThrow('does not match');
  });
});
