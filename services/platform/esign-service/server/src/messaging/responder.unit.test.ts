import { registerESignResponder } from './responder';
import { EventBroker } from '@shared/messaging';
import { signDocumentFromStorage, uploadSignedDocument, publicStorageClient } from '../services';
import { uploadSignedDocumentParamsSchema, signDocumentFromStorageParamsSchema } from '../services';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { uploadFileResultSchema } from '@shared/filestore';
import { signDocumentReturnSchema } from '../services/signing/signing';

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>();
  return {
    ...actual,
    signDocumentFromStorage: vi.fn(),
    uploadSignedDocument: vi.fn(),
    publicStorageClient: { getSignedDownloadUrl: vi.fn() },
  };
});

describe('registerESignResponder', () => {
  let handler: (payload: unknown) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    const broker = {
      respond: vi.fn((subject, cb) => {
        if (subject === ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT) handler = cb;
      }),
    } as unknown as EventBroker;
    registerESignResponder(broker);
  });

  it('signs via claim-check, uploads, and returns a globally-contracted response', async () => {
    const command = mockFromSchema(SignDocumentCommandSchema);

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
      signatureImageBase64: command.signatureImageBase64,
    });
    expect(response.success).toBe(true);
    expect(response.fileHash).toBe(SHA256_HEX);
  });

  it('rejects commands missing fields required locally', async () => {
    const command = mockFromSchema(SignDocumentCommandSchema);
    await expect(handler({ ...command, signatureImageBase64: undefined })).rejects.toThrow();
  });
});
