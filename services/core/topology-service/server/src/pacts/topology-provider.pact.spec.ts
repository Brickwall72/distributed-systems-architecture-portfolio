// File: services/core/topology-service/server/src/pacts/topology-provider.pact.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createTopologyGateway } from '../routes/index.js';

vi.mock('../repositories/index.js', () => {
  return {
    TopologyAssetRepository: class MockTopologyAssetRepository {
      async findAssets() {
        return [
          {
            id: 'ast-101',
            nomenclature: 'AN/PRC-117G',
            serialNumber: 'SN-9982',
            currentOwnerId: 'org-1',
          },
        ];
      }
    },
  };
});

describe('Pact Provider Verification - Topology Server', () => {
  let server: Server;
  const PORT = 8088;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const gateway = createTopologyGateway();
    
    // ✅ Mount under /topology/api/v1 AND /api/v1 to support both gateway and container routing
    app.use('/topology/api/v1', gateway);
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
      provider: 'topology-server',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactUrls: [
        path.resolve(process.cwd(), '../shared/pacts/topology-client-topology-server.json'),
      ],
      stateHandlers: {
        'assets exist for organization org-1': async () => {
          // Repository is mocked; no additional setup required
        },
      },
    });

    await verifier.verifyProvider();
  });
});