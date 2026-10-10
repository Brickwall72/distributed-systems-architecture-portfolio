// File: services/platform/pdf-generator/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';

// 1. Stub all service dependencies called during the request lifecycle
vi.mock('./services', () => ({
  generatePdfFromHtml: async (_html: string) => {
    return Buffer.from('%PDF-1.4 sample content');
  },
  uploadGeneratedDocument: async ({ entityId, documentId }: { entityId: string; documentId: string }) => {
    return {
      s3Uri: `s3://pdf-documents/${entityId}/${documentId}.pdf`,
      bucket: 'pdf-documents',
      key: `${entityId}/${documentId}.pdf`,
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedAt: new Date().toISOString(),
    };
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
      // Replicates Traefik route rewriting: strips leading `/pdf` prefix
      requestFilter: (req: Request, _res: Response, next: NextFunction) => {
        if (req.url.startsWith('/pdf')) {
          req.url = req.url.replace(/^\/pdf/, '');
        }
        next();
      },
      stateHandlers: {
        'pdf generator service is available': async () => {
          return Promise.resolve();
        },
        'the pdf generator engine is healthy': async () => {
          return Promise.resolve();
        },
        'pdf generator engine is healthy': async () => {
          return Promise.resolve();
        },
      },
    };

    await new Verifier(opts).verifyProvider();
    expect(true).toBe(true);
  });
});