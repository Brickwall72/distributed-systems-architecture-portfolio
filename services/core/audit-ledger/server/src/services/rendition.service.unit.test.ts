// File: services/core/audit-ledger/server/src/services/rendition.service.unit.test.ts
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { generatePdfCommandSchema, generatePdfResponseSchema, PDF_SUBJECTS } from '@contracts/pdf';
import type { EventBroker } from '@shared/messaging';
import { overviewRecord } from '../registry';
import { renditionSchema, type RenditionsRepository, type SealedTransfersRepository } from '../repositories';
import { RenditionService } from './rendition.service';
import { getDiagnosticContext, runWithDiagnosticContext } from '@shared/express';

afterEach(() => vi.restoreAllMocks());

describe('RenditionService', () => {
  it.each([true, false])('records the real persistence outcome when claim completion is %s', async (completed) => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const record = overviewRecord();
    const job = mockFromSchema(renditionSchema, {
      sequence: record.sequence, requisitionNumber: record.requisitionNumber,
      sourceRecordHash: record.recordHash, status: 'GENERATING', claimToken: 'claim',
    });
    const sealed = { listAfter: vi.fn().mockResolvedValue([record]), findByRequisition: vi.fn().mockResolvedValue(record) };
    const renditions = { ensure: vi.fn(), claim: vi.fn().mockResolvedValue(job), complete: vi.fn().mockResolvedValue(completed), fail: vi.fn() };
    const broker = { request: vi.fn().mockImplementation((_subject, payload) => {
      const command = generatePdfCommandSchema.parse(payload);
      return Promise.resolve(mockFromSchema(generatePdfResponseSchema, {
        success: true, storageBucket: 'dsap', storageKey: `${command.customPath}/${command.documentId}.pdf`,
        fileHash: SHA256_HEX, presignedUrl: 'https://storage.example/secret',
      }));
    }) };
    const service = new RenditionService(sealed as unknown as SealedTransfersRepository,
      renditions as unknown as RenditionsRepository, broker as unknown as EventBroker);
    await service.tick();
    expect(renditions.ensure).toHaveBeenCalledWith(record);
    expect(broker.request).toHaveBeenCalledWith(PDF_SUBJECTS.GENERATE_AUDIT_PDF, expect.objectContaining({
      requisitionNumber: record.requisitionNumber, html: expect.stringContaining(record.requisitionNumber),
    }), { timeout: 45_000 });
    expect(renditions.complete).toHaveBeenCalledWith(job, {
      storageBucket: 'dsap', storageKey: expect.stringMatching(/^audit\/transfers\/1\/overview-v1\/.+\.pdf$/), fileHash: SHA256_HEX,
    }, expect.any(Date));
    expect(renditions.fail).not.toHaveBeenCalled();
    const records = logs.mock.calls.map(([line]) => JSON.parse(line));
    expect(records).toContainEqual(expect.objectContaining({
      operation: 'audit.rendition.attempt', outcome: completed ? 'success' : 'discarded',
    }));
    expect(JSON.stringify(records)).not.toContain('https://storage.example/secret');
  });

  it('retries malformed or mismatched responses without exposing bearer URLs', async () => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const record = overviewRecord();
    const job = mockFromSchema(renditionSchema, {
      sequence: record.sequence, requisitionNumber: record.requisitionNumber,
      sourceRecordHash: record.recordHash, status: 'GENERATING', claimToken: 'claim',
    });
    const sealed = { listAfter: vi.fn().mockResolvedValue([]), findByRequisition: vi.fn().mockResolvedValue(record) };
    const renditions = { ensure: vi.fn(), claim: vi.fn().mockResolvedValue(job), complete: vi.fn(), fail: vi.fn() };
    const broker = { request: vi.fn().mockResolvedValue({
      success: true, storageBucket: 'dsap', storageKey: 'wrong.pdf', fileHash: SHA256_HEX,
      presignedUrl: 'https://storage.example/secret',
    }) };
    const service = new RenditionService(sealed as unknown as SealedTransfersRepository,
      renditions as unknown as RenditionsRepository, broker as unknown as EventBroker);
    await service.tick();
    expect(renditions.complete).not.toHaveBeenCalled();
    expect(renditions.fail).toHaveBeenCalledWith(job, 'request PDF generation: Error', expect.any(Date));
    const records = logs.mock.calls.map(([line]) => JSON.parse(line));
    expect(records).toContainEqual(expect.objectContaining({ operation: 'audit.rendition.attempt', outcome: 'failure' }));
    expect(records).not.toContainEqual(expect.objectContaining({ operation: 'audit.rendition.attempt', outcome: 'success' }));
  });

  it('finishes a slow paginated sweep before restarting it', async () => {
    vi.useFakeTimers();
    try {
      const record = overviewRecord();
      const page = Array.from({ length: 100 }, (_, index) => ({ ...record, sequence: index + 1 }));
      const sealed = { listAfter: vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce([{ ...record, sequence: 101 }]) };
      const renditions = { ensure: vi.fn(), claim: vi.fn().mockResolvedValue(null) };
      const service = new RenditionService(sealed as unknown as SealedTransfersRepository,
        renditions as unknown as RenditionsRepository, {} as EventBroker);
      await service.tick();
      vi.advanceTimersByTime(120_000);
      await service.tick();
      expect(sealed.listAfter).toHaveBeenNthCalledWith(2, 100, 100);
      expect(renditions.ensure).toHaveBeenCalledTimes(101);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retain the triggering request context when a rendition is nudged', async () => {
    vi.useFakeTimers();
    const record = overviewRecord();
    const job = mockFromSchema(renditionSchema, {
      sequence: record.sequence, requisitionNumber: record.requisitionNumber,
      sourceRecordHash: record.recordHash, status: 'GENERATING', claimToken: 'claim',
    });
    const sealed = { listAfter: vi.fn().mockResolvedValue([]), findByRequisition: vi.fn().mockResolvedValue(record) };
    const renditions = { ensure: vi.fn(), claim: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null), fail: vi.fn() };
    let attemptId: string | undefined;
    const broker = { request: vi.fn().mockImplementation(async () => {
      attemptId = getDiagnosticContext()?.correlationId;
      throw new Error('test failure');
    }) };
    const service = new RenditionService(sealed as unknown as SealedTransfersRepository,
      renditions as unknown as RenditionsRepository, broker as unknown as EventBroker);
    try {
      runWithDiagnosticContext({ correlationId: 'triggering-request' }, () => service.start());
      await vi.advanceTimersByTimeAsync(1);
      expect(attemptId).toBeTruthy();
      expect(attemptId).not.toBe('triggering-request');
      expect(getDiagnosticContext()).toBeUndefined();
    } finally {
      await service.stop();
      vi.useRealTimers();
    }
  });
});
