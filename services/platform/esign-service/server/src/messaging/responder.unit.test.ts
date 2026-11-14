// File: services/platform/esign-service/server/src/messaging/responder.unit.test.ts
import { registerESignResponder } from './responder';
import { EventBroker } from '@shared/messaging';
import {
  signDocumentFromStorage, uploadSignedDocument, publicStorageClient, downloadDocumentStream,
  uploadSignedDocumentParamsSchema, signDocumentFromStorageParamsSchema, signDocumentReturnSchema,
} from '../services';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { InMemoryStorageClient, ObjectNotFoundError, uploadFileResultSchema } from '@shared/filestore';

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>();
  return {
    ...actual,
    signDocumentFromStorage: vi.fn(),
    uploadSignedDocument: vi.fn(),
    downloadDocumentStream: vi.fn(),
    publicStorageClient: { getSignedDownloadUrl: vi.fn() },
  };
});

describe('registerESignResponder', () => {
  let handler: (payload: unknown) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadDocumentStream).mockRejectedValue(new ObjectNotFoundError('Not found'));
    const broker = {
      respond: vi.fn((subject, cb) => {
        if (subject === ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT) handler = cb;
      }),
    } as unknown as EventBroker;
    registerESignResponder(broker);
  });

  it('signs via claim-check, uploads, and returns a globally-contracted response', async () => {
    const command = mockFromSchema(SignDocumentCommandSchema, { fileHash: SHA256_HEX });

    vi.mocked(signDocumentFromStorage).mockResolvedValueOnce(
      mockFromSchema(signDocumentReturnSchema, {
        pdfBuffer: Buffer.from('signed-pdf'),
        signedAt: new Date().toISOString(),
      }),
    );
    vi.mocked(uploadSignedDocument).mockResolvedValueOnce(
      mockFromSchema(uploadFileResultSchema, { fileHash: SHA256_HEX, uploadedAt: new Date().toISOString() }),
    );
    vi.mocked(publicStorageClient.getSignedDownloadUrl).mockResolvedValueOnce(
      'http://localhost:9000/bucket/key.pdf?signature=xyz',
    );

    const response = SignDocumentResponseSchema.parse(await handler(command));

    // Services must receive payloads that satisfy their own schemas
    signDocumentFromStorageParamsSchema.parse(vi.mocked(signDocumentFromStorage).mock.calls[0][0]);
    uploadSignedDocumentParamsSchema.parse(vi.mocked(uploadSignedDocument).mock.calls[0][0]);

    expect(vi.mocked(signDocumentFromStorage).mock.calls[0][0]).toMatchObject({
      storageBucket: command.storageBucket,
      storageKey: command.storageKey,
      fileHash: SHA256_HEX,
      signatureImageBase64: command.signatureImageBase64,
    });
    expect(response.success).toBe(true);
    expect(response.fileHash).toBe(SHA256_HEX);
  });

  it('rejects commands missing fields required locally', async () => {
    const command = mockFromSchema(SignDocumentCommandSchema);
    await expect(handler({ ...command, signatureImageBase64: undefined })).rejects.toThrow();
  });

  it('reuses the signed artifact for identical retries and rejects a different signing request', async () => {
    const storage = new InMemoryStorageClient();
    vi.mocked(downloadDocumentStream).mockImplementation((request) => storage.getFileStream(request));
    vi.mocked(uploadSignedDocument).mockImplementation((request) => storage.uploadFile({ ...request, contentType: 'application/pdf' }));
    vi.mocked(signDocumentFromStorage).mockResolvedValue({
      pdfBuffer: Buffer.from('signed-pdf'), signedAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(publicStorageClient.getSignedDownloadUrl).mockResolvedValue('http://localhost:9000/bucket/key.pdf');
    const command = mockFromSchema(SignDocumentCommandSchema, { fileHash: SHA256_HEX });

    const first = SignDocumentResponseSchema.parse(await handler(command));
    const retry = SignDocumentResponseSchema.parse(await handler(command));
    expect(retry).toEqual(first);
    expect(signDocumentFromStorage).toHaveBeenCalledTimes(1);
    expect(uploadSignedDocument).toHaveBeenCalledTimes(1);
    await expect(handler({ ...command, signatureImageBase64: 'different' })).rejects.toThrow('different request');
  });

  it('resolves concurrent identical requests to one stored signed artifact', async () => {
    const storage = new InMemoryStorageClient();
    vi.mocked(downloadDocumentStream).mockImplementation((request) => storage.getFileStream(request));
    vi.mocked(uploadSignedDocument).mockImplementation((request) => storage.uploadFile({ ...request, contentType: 'application/pdf' }));
    let counter = 0;
    vi.mocked(signDocumentFromStorage).mockImplementation(async () => ({
      pdfBuffer: Buffer.from(`signed-pdf-${++counter}`), signedAt: '2026-01-01T00:00:00.000Z',
    }));
    vi.mocked(publicStorageClient.getSignedDownloadUrl).mockResolvedValue('http://localhost:9000/bucket/key.pdf');
    const command = mockFromSchema(SignDocumentCommandSchema, { fileHash: SHA256_HEX });

    const [first, second] = await Promise.all([handler(command), handler(command)]);
    expect(SignDocumentResponseSchema.parse(first)).toEqual(SignDocumentResponseSchema.parse(second));
    expect(storage.storage.size).toBe(1);
  });
});
