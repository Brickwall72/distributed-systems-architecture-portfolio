// File: services/platform/esignature-service/client/src/api/esignApi.contract.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { signDocument } from './esignApi';

const provider = new PactV3({
  consumer: 'esignature-client',
  provider: 'esignature-service',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('esignApi Pact Consumer Tests', () => {
  const mockPdfBlobUrl = 'blob:http://localhost/mock-pdf';
  const mockSignatureDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeEach(() => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          return Promise.resolve(
            new Response('%PDF-1.7-mock-binary-data', {
              status: 200,
              headers: { 'Content-Type': 'application/pdf' },
            })
          );
        }
        return originalFetch(url, init);
      })
    );

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://localhost/signed-result-pdf'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('successfully posts a signature payload and receives a signed PDF blob', async () => {
    const validDocumentId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    provider
      .given('esignature service is healthy')
      .uponReceiving('a request to apply a signature to a PDF document')
      .withRequest({
        method: 'POST',
        path: '/esign/api/v1/signature',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': MatchersV3.regex(/^esign-req-.+$/, 'esign-req-123456789'),
        },
        body: {
          pdfBase64: MatchersV3.like('SlZCRVJpMHhMak5oYldCck1HOXphVzVsYm1R'),
          signatureImageBase64: MatchersV3.like(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          ),
          documentId: MatchersV3.uuid(validDocumentId),
          signerId: MatchersV3.like('usr-actor-404'),
          entityId: MatchersV3.like('org-armory-01'),
          customPath: MatchersV3.like('/docs/signed'),
          documentType: MatchersV3.like('DD-1149'),
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: MatchersV3.like('%PDF-1.7-signed-output-binary'),
      });

    await provider.executeTest(async (mockServer) => {
      const resultBlobUrl = await signDocument(
        {
          pdfBlobUrl: mockPdfBlobUrl,
          signatureDataUrl: mockSignatureDataUrl,
          documentId: validDocumentId,
          signerId: 'usr-actor-404',
          entityId: 'org-armory-01',
          customPath: '/docs/signed',
          documentType: 'DD-1149',
        },
        mockServer.url
      );

      expect(resultBlobUrl).toBe('blob:http://localhost/signed-result-pdf');
    });
  });

  it('handles backend processing error responses gracefully', async () => {
    const validDocumentId = 'b1ffcd00-0d1c-4fe9-a27e-7cc0ce491b22';

    provider
      .given('document ID processing triggers internal failure')
      .uponReceiving('an invalid or unprocessable signature request')
      .withRequest({
        method: 'POST',
        path: '/esign/api/v1/signature',
        headers: {
          'Content-Type': 'application/json',
        },
        body: MatchersV3.like({
          pdfBase64: 'SlZCRVJpMHhMak5oYldCck1HOXphVzVsYm1R',
          signatureImageBase64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          documentId: validDocumentId,
          signerId: 'usr-actor-404',
          entityId: 'org-armory-01',
        }),
      })
      .willRespondWith({
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          error: MatchersV3.like('Signature Verification Engine Failure'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      await expect(
        signDocument(
          {
            pdfBlobUrl: mockPdfBlobUrl,
            signatureDataUrl: mockSignatureDataUrl,
            documentId: validDocumentId,
            signerId: 'usr-actor-404',
            entityId: 'org-armory-01',
          },
          mockServer.url
        )
      ).rejects.toThrow('Signature Verification Engine Failure');
    });
  });
});