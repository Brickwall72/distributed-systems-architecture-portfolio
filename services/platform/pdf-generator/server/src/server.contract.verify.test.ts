// File: services/platform/pdf-generator/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';
import { vi } from 'vitest';

// 1. Mock the heavy PDF generation service so the test stays lightweight and fast
vi.mock('./services/pdfService.js', () => ({
  generatePdfFromHtml: async (_html: string) => {
    // Return a mock PDF buffer matching what the consumer contract expects
    return Buffer.from('%PDF-1.4\n%MockBinaryData');
  },
}));

import app from './server'; // Adjust import to your main server export file

describe('Pact Provider Verification', () => {
  let server: any;
  const port = 8083; // Use a unique port for this service

  beforeAll(() => {
    server = app.listen(port);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('validates expected contracts from pdf-client', async () => {
    const opts = {
      provider: 'pdf-server',
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/pdf-client-pdf-server.json'),
      ],
      stateHandlers: {
        'the pdf generator engine is healthy': async () => {
          // State hook is satisfied since our mock service is ready
          return Promise.resolve();
        },
      },
    };

    await new Verifier(opts).verifyProvider();
    expect(true).toBe(true);
  });
});