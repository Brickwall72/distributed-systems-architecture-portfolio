// File: services/platform/esign-service/server/src/services/signing/signDocumentFromStorage.unit.test.ts
import { zocker } from 'zocker';
import { signDocumentFromStorage, signDocumentFromStorageParamsSchema, signDocument, signDocumentReturnSchema } from './index';
import { downloadDocumentStream } from '../storage';
import { createHash } from 'node:crypto';

vi.mock('../storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage')>();
  return { ...actual, downloadDocumentStream: vi.fn() };
});

vi.mock('./signing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./signing')>();
  return {
    ...actual,
    signDocument: vi.fn().mockImplementation(async () =>
      actual.signDocumentReturnSchema.parse({
        pdfBuffer: Buffer.from('signed-pdf'),
        signedAt: '2026-10-18T21:00:00.000Z',
      }),
    ),
  };
});

describe('signDocumentFromStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the source document, then signs the buffered content', async () => {
    const pdfContent = Buffer.from('mock-pdf-binary-content');
    vi.mocked(downloadDocumentStream).mockResolvedValueOnce({
      stream: (async function* () {
        yield pdfContent;
      })(),
    } as never);

    const params = signDocumentFromStorageParamsSchema.parse(
      { ...zocker(signDocumentFromStorageParamsSchema.omit({ client: true, fileHash: true })).generate(),
        fileHash: createHash('sha256').update(pdfContent).digest('hex') },
    );

    const result = await signDocumentFromStorage(params);

    expect(downloadDocumentStream).toHaveBeenCalledWith(
      expect.objectContaining({ storageBucket: params.storageBucket, storageKey: params.storageKey }),
    );
    expect(signDocument).toHaveBeenCalledWith({
      pdfBuffer: pdfContent,
      signatureImageBase64: params.signatureImageBase64,
    });
    expect(signDocumentReturnSchema.parse(result)).toEqual(result);
  });

  it('rejects a modified draft before signing', async () => {
    vi.mocked(downloadDocumentStream).mockResolvedValueOnce({
      stream: (async function* () { yield Buffer.from('modified'); })(),
    } as never);
    const params = signDocumentFromStorageParamsSchema.parse({
      ...zocker(signDocumentFromStorageParamsSchema.omit({ client: true, fileHash: true })).generate(),
      fileHash: createHash('sha256').update('original').digest('hex'),
    });

    await expect(signDocumentFromStorage(params)).rejects.toThrow('Stored draft hash does not match');
    expect(signDocument).not.toHaveBeenCalled();
  });
});
