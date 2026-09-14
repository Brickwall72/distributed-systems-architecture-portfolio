// File: services/core/compliance-service/client/src/api/save-document.unit.test.ts
import { saveDocument } from './save-document';

describe('saveDocument API Client', () => {
  const mockDocumentUrl = 'blob:http://localhost/mock-blob-uuid';

  beforeEach(() => {
    vi.clearAllMocks();

    // Stub global.fetch
    global.fetch = vi.fn();

    // Stub window.FileReader to instantly trigger onloadend with mock base64 data
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:application/pdf;base64,dGVzdC1iYXNlNjQ=';
        onloadend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          if (this.onloadend) {
            this.onloadend();
          }
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('successfully fetches blob, converts to base64, and posts to backend', async () => {
    // 1. Mock fetch response for the local blob URL
    const mockBlob = new Blob(['test-pdf-content'], { type: 'application/pdf' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    // 2. Mock fetch response for the backend API POST
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await expect(saveDocument(mockDocumentUrl)).resolves.not.toThrow();

    // Verify first fetch called the local blob URL
    expect(global.fetch).toHaveBeenNthCalledWith(1, mockDocumentUrl);

    // Verify second fetch posted the correct payload to the compliance endpoint
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/compliance/documents/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfBase64: 'dGVzdC1iYXNlNjQ=',
        documentType: 'transfer-approval',
      }),
    });
  });

  it('throws an error if local blob fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(saveDocument(mockDocumentUrl)).rejects.toThrow(
      'Failed to fetch local PDF blob for persistence.'
    );
  });

  it('throws an error if FileReader cannot read the blob', async () => {
    const mockBlob = new Blob(['test-pdf-content'], { type: 'application/pdf' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    vi.stubGlobal(
      'FileReader',
      class {
        result = null;
        onloadend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onerror?.();
        }
      }
    );

    await expect(saveDocument(mockDocumentUrl)).rejects.toThrow(
      'Failed to read blob as data URL.'
    );
  });

  it('throws an error with backend message if server returns a failure status', async () => {
    const mockBlob = new Blob(['test-pdf-content'], { type: 'application/pdf' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'MinIO storage bucket connection failed' }),
    });

    await expect(saveDocument(mockDocumentUrl)).rejects.toThrow(
      'MinIO storage bucket connection failed'
    );
  });
});