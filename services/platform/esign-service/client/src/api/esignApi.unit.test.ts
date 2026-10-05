// File: services/platform/esign-service/client/src/api/esignApi.unit.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signDocument, SignDocumentParams } from './esignApi';

describe('signDocument API Client', () => {
  const mockParams: SignDocumentParams = {
    pdfBlobUrl: 'blob:http://localhost/test-blob-id',
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Valid UUID v4
    signerId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',   // Valid UUID v4
    entityId: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',   // Valid UUID v4
    documentType: 'DD-1149',
  };

  const mockPdfBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global URL.createObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/signed-pdf-id');

    // Mock crypto.randomUUID
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetchMocks(options?: {
    blobSuccess?: boolean;
    apiSuccess?: boolean;
    apiStatus?: number;
    apiErrorJson?: object;
  }) {
    const {
      blobSuccess = true,
      apiSuccess = true,
      apiStatus = 200,
      apiErrorJson = { error: 'Invalid payload' },
    } = options || {};

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      // Mock fetching internal blob URL
      if (url === mockParams.pdfBlobUrl) {
        if (!blobSuccess) {
          return Promise.resolve({
            ok: false,
            status: 404,
          } as Response);
        }
        const blob = new Blob([Buffer.from(mockPdfBase64, 'base64')], { type: 'application/pdf' });
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(blob),
        } as Response);
      }

      // Mock POST /esign/api/v1/signature
      if (url.endsWith('/esign/api/v1/signature')) {
        if (!apiSuccess) {
          return Promise.resolve({
            ok: false,
            status: apiStatus,
            json: () => Promise.resolve(apiErrorJson),
          } as Response);
        }
        const responseBlob = new Blob(['Signed PDF Content'], { type: 'application/pdf' });
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(responseBlob),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });
  }

  it('successfully fetches source blob, transforms payload, and calls backend endpoint', async () => {
    setupFetchMocks();

    class MockFileReader {
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result = `data:application/pdf;base64,${mockPdfBase64}`;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const resultBlobUrl = await signDocument(mockParams, 'http://api.internal');

    expect(resultBlobUrl).toBe('blob:http://localhost/signed-pdf-id');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    const [apiUrl, fetchOptions] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(apiUrl).toBe('http://api.internal/esign/api/v1/signature');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers).toEqual({
      'Content-Type': 'application/json',
      'x-correlation-id': 'esign-req-12345678-1234-1234-1234-123456789abc',
    });

    const parsedBody = JSON.parse(fetchOptions.body);
    expect(parsedBody.pdfBase64).toBe(mockPdfBase64);
    expect(parsedBody.signatureImageBase64).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    expect(parsedBody.documentId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('throws an error if source document blob fetch fails', async () => {
    setupFetchMocks({ blobSuccess: false });

    await expect(signDocument(mockParams)).rejects.toThrow(
      'Failed to fetch source document (404)'
    );
  });

  it('throws a schema validation error if required fields are missing or invalid', async () => {
    setupFetchMocks();

    class MockFileReader {
      onloadend: (() => void) | null = null;
      result = `data:application/pdf;base64,${mockPdfBase64}`;
      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const invalidParams = { ...mockParams, documentId: 'invalid-uuid' };

    await expect(signDocument(invalidParams)).rejects.toThrow();
  });

  it('handles backend service API error responses cleanly', async () => {
    setupFetchMocks({
      apiSuccess: false,
      apiStatus: 422,
      apiErrorJson: { error: 'Invalid signature dimensions' },
    });

    class MockFileReader {
      onloadend: (() => void) | null = null;
      result = `data:application/pdf;base64,${mockPdfBase64}`;
      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await expect(signDocument(mockParams)).rejects.toThrow('Invalid signature dimensions');
  });

  it('falls back to HTTP status error when API response is non-JSON', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === mockParams.pdfBlobUrl) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob()),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('SyntaxError')),
      } as Response);
    });

    class MockFileReader {
      onloadend: (() => void) | null = null;
      result = 'data:application/pdf;base64,AAA=';
      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await expect(signDocument(mockParams)).rejects.toThrow('Server returned status 502');
  });
});