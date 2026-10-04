// File: services/core/compliance-service/server/src/server.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import { Server } from 'http';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';

import app from './server.js';
import { TemplateRepository } from './repositories/Templates/Templates.js';
import { ComplianceDocumentRepository } from './db/documents.repository.js';

describe('Compliance Service Provider Verification', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (server) {
        server.close((err) => (err ? reject(err) : resolve()));
      } else {
        resolve();
      }
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'validates the expectations of compliance-client',
    async () => {
      const pactPath =
        process.env.PACT_FILE_PATH ||
        path.resolve(__dirname, '../../client/pacts/compliance-client-compliance-server.json');

      const opts = {
        providerBaseUrl: `http://localhost:${port}`,
        provider: 'compliance-server',
        pactUrls: [pactPath],
        requestFilter: (req: Request, _res: Response, next: NextFunction) => {
          if (req.url.startsWith('/compliance/')) {
            req.url = req.url.replace(/^\/compliance/, '');
          }
          next();
        },
        stateHandlers: {
          'compliance documents exist in the database': async () => {
            // Spies on instance prototype to bypass PostgreSQL connection in CI
            vi.spyOn(ComplianceDocumentRepository.prototype, 'findAll').mockResolvedValue([
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                document_type: 'DD-1149',
                status: 'Approved',
                s3_uri: 's3://compliance-vault/2026/dd1149.pdf',
                created_at: '2026-09-15T14:32:00Z',
              },
            ]);
          },
          'compliance templates exist in the registry': async () => {
            const manifest = TemplateRepository.findAll();
            if (manifest.length === 0) {
              throw new Error('State handler failed: Template repository is empty.');
            }
          },
          'template contract-test-bare exists': async () => {
            const template = TemplateRepository.findById('contract-test-bare');
            if (!template) {
              throw new Error('State handler failed: Template [contract-test-bare] missing from TEMPLATES_DB.');
            }
          },
        },
      };

      const verifier = new Verifier(opts);
      const result = await verifier.verifyProvider();
      expect(result).toBeTruthy();
    },
    30000
  );
});