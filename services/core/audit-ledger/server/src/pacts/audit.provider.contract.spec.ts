// File: services/core/audit-ledger/server/src/pacts/audit.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { transferSummarySchema } from 'audit-shared';
import { mockFromSchema } from '@shared/testing';
import { createAuditGateway } from '../routes';
import { LedgerService } from '../services';

type Behavior = 'sealed' | 'all' | 'failing';

describe('Pact Provider Verification - Audit Server', () => {
  let server: Server;
  let behavior: Behavior = 'all';
  const PORT = 8090;
  // Same seed as the consumer spec so optional keys line up with the committed pact examples
  const seed = { seed: 1 };

  beforeAll(async () => {
    const ledgerService = Object.assign(Object.create(LedgerService.prototype), {
      listTransfers: async () => {
        if (behavior === 'failing') throw new Error('Internal server error.');
        return [mockFromSchema(transferSummarySchema, behavior === 'sealed' ? { status: 'SEALED' } : {}, seed)];
      },
    }) as LedgerService;

    const app = express();
    app.use(express.json());
    const gateway = createAuditGateway({ ledgerService });
    app.use('/audit/api/v1', gateway);
    app.use('/api/v1', gateway);

    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('validates provider implementation against generated consumer pacts', async () => {
    const verifier = new Verifier({
      provider: 'audit-server',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactUrls: [path.resolve(process.cwd(), '../shared/pacts/audit-client-audit-server.json')],
      stateHandlers: {
        'ledger transfers exist': async () => {
          behavior = 'all';
        },
        'sealed ledger transfers exist': async () => {
          behavior = 'sealed';
        },
        'the ledger service is failing': async () => {
          behavior = 'failing';
        },
      },
    });

    await verifier.verifyProvider();
  });
});
