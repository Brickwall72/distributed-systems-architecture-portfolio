import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zocker } from 'zocker';
import { EventBroker } from '@shared/messaging';
import { registerPdfResponder } from './responder';
import { PDF_SUBJECTS, generatePdfCommandSchema as globalCommandSchema, generatePdfResponseSchema } from '@contracts/pdf';
import { SHA256_HEX } from '@shared/testing';
import { generatePdfFromHtml, uploadGeneratedDocument } from '../services';

// Only I/O is mocked; schemas stay real.
vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>();
  return {
    ...actual,
    generatePdfFromHtml: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock content')),
    uploadGeneratedDocument: vi.fn().mockImplementation(async (payload) => {
      // The responder must hand the service a payload satisfying its own schema
      actual.uploadGeneratedDocumentRequestSchema.parse(payload);
      return { fileHash: SHA256_HEX, uploadedAt: new Date().toISOString() };
    }),
    publicStorageClient: {
      getSignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.internal/presigned-download-url'),
    },
  };
});

describe('registerPdfResponder', () => {
  let handlers: Record<string, (payload: unknown) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    const mockBroker = {
      respond: vi.fn((subject, handler) => {
        handlers[subject] = handler;
      }),
    } as unknown as EventBroker;

    registerPdfResponder(mockBroker);
  });

  it('accepts a globally-contracted command and returns a globally-contracted response', async () => {
    const command = { ...zocker(globalCommandSchema).generate(), documentId: 'document-1', customPath: 'compliance/drafts' };

    const response = generatePdfResponseSchema.parse(await handlers[PDF_SUBJECTS.GENERATE_PDF](command));

    expect(response.success).toBe(true);
    expect(response.presignedUrl).toContain('https://');
    expect(response.fileHash).toHaveLength(64);
  });

  it('rejects payloads that do not satisfy the local schema', async () => {
    const command = { ...zocker(globalCommandSchema).generate(), documentId: 'document-1', customPath: 'compliance/drafts' };
    await expect(handlers[PDF_SUBJECTS.GENERATE_PDF]({ ...command, html: undefined })).rejects.toThrow();
  });

  it.each(['render', 'upload'] as const)('identifies %s failure without logging payloads or false success', async (stage) => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const failure = new Error('https://storage.example/file?secret=private-token');
      if (stage === 'render') vi.mocked(generatePdfFromHtml).mockRejectedValueOnce(failure);
      else vi.mocked(uploadGeneratedDocument).mockRejectedValueOnce(failure);
      const command = {
        ...zocker(globalCommandSchema).generate(), documentId: 'document-1',
        customPath: 'compliance/drafts', html: '<p>private HTML</p>',
      };
      await expect(handlers[PDF_SUBJECTS.GENERATE_PDF](command)).rejects.toBe(failure);
      const records = logs.mock.calls.map(([line]) => JSON.parse(line));
      expect(records).toContainEqual(expect.objectContaining({ operation: `pdf.${stage}`, outcome: 'failure' }));
      expect(records).toContainEqual(expect.objectContaining({ operation: 'pdf.generate', outcome: 'failure' }));
      expect(records).not.toContainEqual(expect.objectContaining({ operation: 'pdf.generate', outcome: 'success' }));
      expect(JSON.stringify(records)).not.toMatch(/private-token|private HTML/);
    } finally {
      logs.mockRestore();
    }
  });

  it('only allows paths belonging to the caller-specific subject', async () => {
    const command = { ...zocker(globalCommandSchema).generate(), documentId: 'document-1', customPath: 'audit/transfers/1/overview-v1' };
    await expect(handlers[PDF_SUBJECTS.GENERATE_AUDIT_PDF](command)).resolves.toBeDefined();
    await expect(handlers[PDF_SUBJECTS.GENERATE_PDF](command)).rejects.toThrow('permitted storage prefix');
    await expect(handlers[PDF_SUBJECTS.GENERATE_AUDIT_PDF]({ ...command, customPath: 'audit/transfers/../overview-v1' })).rejects.toThrow('permitted storage prefix');
    await expect(handlers[PDF_SUBJECTS.GENERATE_AUDIT_PDF]({ ...command, documentId: '../other' })).rejects.toThrow('permitted storage prefix');
  });
});
