// File: services/platform/esignature-service/server/src/services/signing/signDocumentFromStorage.unit.test.ts
import { signDocumentFromStorage } from './signDocumentFromStorage';
import { downloadDocumentStream } from '../storage';
import { signDocument } from './signing';

// Mock dependencies
vi.mock('../storage', () => ({
  downloadDocumentStream: vi.fn(),
}));

vi.mock('./signing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./signing')>();
  return {
    ...actual,
    signDocument: vi.fn().mockResolvedValue({
      pdfBuffer: Buffer.from('signed-pdf'),
      signedAt: '2026-10-18T21:00:00.000Z',
    }),
  };
});

describe('signDocumentFromStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads document stream from storage, converts to base64, and calls signDocument', async () => {
    const mockPdfContent = 'mock-pdf-binary-content';
    const mockChunks = [Buffer.from(mockPdfContent)];

    // Mock downloadDocumentStream returning an async iterable stream
    vi.mocked(downloadDocumentStream).mockResolvedValueOnce({
      stream: (async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      })(),
    } as any);

    const result = await signDocumentFromStorage({
      storageBucket: 'custom-bucket',
      storageKey: 'tenant-123/doc-456.pdf',
      signatureImageBase64: 'base64-signature-data',
      correlationId: 'corr-xyz',
    });

    expect(downloadDocumentStream).toHaveBeenCalledWith({
      bucket: 'custom-bucket',
      key: 'tenant-123/doc-456.pdf',
    });

    const expectedBase64Pdf = Buffer.from(mockPdfContent).toString('base64');

    expect(signDocument).toHaveBeenCalledWith({
      pdfBase64: expectedBase64Pdf,
      signatureImageBase64: 'base64-signature-data',
      correlationId: 'corr-xyz',
    });

    expect(result).toEqual({
      pdfBuffer: expect.any(Buffer),
      signedAt: '2026-10-18T21:00:00.000Z',
    });
  });
});