import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zocker } from 'zocker';
import { EventBroker } from '@shared/messaging';
import { registerPdfResponder } from './responder';
import { PDF_SUBJECTS, generatePdfCommandSchema as globalCommandSchema, generatePdfResponseSchema } from '@contracts/pdf';
import { SHA256_HEX } from '@shared/testing';

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
  let registeredHandler: (payload: unknown) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockBroker = {
      respond: vi.fn((subject, handler) => {
        if (subject === PDF_SUBJECTS.GENERATE_PDF) registeredHandler = handler;
      }),
    } as unknown as EventBroker;

    registerPdfResponder(mockBroker);
  });

  it('accepts a globally-contracted command and returns a globally-contracted response', async () => {
    const command = zocker(globalCommandSchema).generate();

    const response = generatePdfResponseSchema.parse(await registeredHandler(command));

    expect(response.success).toBe(true);
    expect(response.presignedUrl).toContain('https://');
    expect(response.fileHash).toHaveLength(64);
  });

  it('rejects payloads that do not satisfy the local schema', async () => {
    const command = zocker(globalCommandSchema).generate();
    await expect(registeredHandler({ ...command, html: undefined })).rejects.toThrow();
  });
});
