// File: services/core/audit-ledger/server/src/services/rendition.service.unit.test.ts
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { generatePdfCommandSchema, generatePdfResponseSchema, PDF_SUBJECTS } from '@contracts/pdf';
import type { EventBroker } from '@shared/messaging';
import { overviewRecord } from '../registry/overview.test-support';
import { renditionSchema, type RenditionsRepository } from '../repositories/renditions';
import type { SealedTransfersRepository } from '../repositories/sealed/sealed.repository';
import { RenditionService } from './rendition.service';

describe('RenditionService', () => {
  it('reconciles sealed records and validates the PDF service boundary without retaining the URL', async () => {
    const record = overviewRecord();
    const job = mockFromSchema(renditionSchema, {
      sequence: record.sequence, requisitionNumber: record.requisitionNumber,
      sourceRecordHash: record.recordHash, status: 'GENERATING', claimToken: 'claim',
    });
    const sealed = { listAfter: vi.fn().mockResolvedValue([record]), findByRequisition: vi.fn().mockResolvedValue(record) };
    const renditions = { ensure: vi.fn(), claim: vi.fn().mockResolvedValue(job), complete: vi.fn().mockResolvedValue(true), fail: vi.fn() };
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
    expect(broker.request).toHaveBeenCalledWith(PDF_SUBJECTS.GENERATE_PDF, expect.objectContaining({
      requisitionNumber: record.requisitionNumber, html: expect.stringContaining(record.requisitionNumber),
    }), { timeout: 45_000 });
    expect(renditions.complete).toHaveBeenCalledWith(job, {
      storageBucket: 'dsap', storageKey: expect.stringMatching(/^audit\/transfers\/1\/overview-v1\/.+\.pdf$/), fileHash: SHA256_HEX,
    }, expect.any(Date));
    expect(renditions.fail).not.toHaveBeenCalled();
  });

  it('retries malformed or mismatched responses without exposing bearer URLs', async () => {
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
});
