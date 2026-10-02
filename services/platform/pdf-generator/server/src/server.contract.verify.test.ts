// File: services/platform/pdf-generator/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// 1. Mock the heavy PDF generation service so the test stays lightweight and fast
vi.mock('./services/pdfService.js', () => ({
  generatePdfFromHtml: async (_html: string) => {
    // Return a mock PDF buffer matching what the consumer contract expects
    return Buffer.from('%PDF-1.4 sample content');
  },
}));

import app from './server';

describe('Pact Provider Verification', () => {
  let server: any;
  const port = 8089;

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
      // Replicates Traefik route rewriting: strips leading `/pdf` prefix before sending to Express router
      requestFilter: (req: Request, _res: Response, next: NextFunction) => {
        if (req.url.startsWith('/pdf/')) {
          req.url = req.url.replace(/^\/pdf/, '');
        }
        next();
      },
      stateHandlers: {
        // Matches the consumer .given('pdf generator service is available') clause
        'pdf generator service is available': async () => {
          return Promise.resolve();
        },
      },
    };

    await new Verifier(opts).verifyProvider();
    expect(true).toBe(true);
  });
});