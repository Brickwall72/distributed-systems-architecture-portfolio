// File: services/core/compliance-service/client/src/api/save-document.contract.test.ts
import { MatchersV3 } from '@pact-foundation/pact';
import { createPactTestHelper } from '@shared/testing';
import { saveDocument } from './save-document';

const { like, regex } = MatchersV3;
const runConsumerContractTest = createPactTestHelper({
  consumer: 'compliance-client',
  provider: 'compliance-server',
});

describe('saveDocument Consumer Contract', () => {
  const mockDocumentUrl = 'blob:http://localhost/mock-blob-uuid';

  beforeEach(() => {
    // Stub FileReader to instantly convert the blob into base64 during execution
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

  it('generates a valid contract for saving a compliance document', async () => {
    await runConsumerContractTest(
      (provider) => {
        provider
          .given('compliance document backend is ready to accept saves')
          .uponReceiving('a POST request to save a compliance document')
          .withRequest({
            method: 'POST',
            path: '/compliance/api/v1/documents/',
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              pdfBase64: 'dGVzdC1iYXNlNjQ=',
              documentType: 'transfer-approval',
            },
          })
          .willRespondWith({
            status: 201,
            headers: {
              'Content-Type': regex('application/json.*', 'application/json; charset=utf-8'),
            },
            body: {
              success: true,
              data: {
                id: like(42),
                documentId: like('123e4567-e89b-12d3-a456-426614174000'),
                documentType: like('transfer-approval'),
                s3Uri: like('s3://compliance-documents/transfer-approval/test.pdf'),
                createdAt: like('2026-09-12T19:00:00.000Z'),
              },
            },
          });
      },
      async () => {
        const originalFetch = global.fetch;
        const mockBlob = new Blob(['test-pdf-content'], { type: 'application/pdf' });

        // Intercept local blob URL fetch, let backend POST hit the Pact mock server
        global.fetch = vi.fn().mockImplementation(async (input, init) => {
          if (input === mockDocumentUrl) {
            return {
              ok: true,
              blob: async () => mockBlob,
            } as Response;
          }
          return originalFetch(input, init);
        });

        try {
          await saveDocument(mockDocumentUrl);
        } finally {
          global.fetch = originalFetch;
        }
      }
    );
  });
});