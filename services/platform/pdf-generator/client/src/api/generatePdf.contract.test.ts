// File: services/platform/pdf-generator/client/src/api/generatePdf.contract.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { generatePdf } from './generatePdf';

const provider = new PactV3({
  consumer: 'pdf-client',
  provider: 'pdf-server',
});

describe('generatePdf Pact Contract Test', () => {
  beforeAll(() => {
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-pact-blob-id');
    }
  });

  it('generates a PDF binary stream from HTML input', () => {
    const htmlPayload = '<h1>Invoice #1001</h1>';

    provider
      .given('pdf generator service is available')
      .uponReceiving('a request to compile HTML into a PDF')
      .withRequest({
        method: 'POST',
        path: '/pdf/api/v1/generator',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          html: MatchersV3.like(htmlPayload),
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
        },
        // Use raw literal body for non-JSON content types (e.g., application/pdf)
        body: '%PDF-1.4 sample content',
      });

    return provider.executeTest(async (mockServer) => {
      const result = await generatePdf(htmlPayload, { baseUrl: mockServer.url });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});