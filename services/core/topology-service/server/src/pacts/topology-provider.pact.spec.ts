// File: services/core/topology-service/server/src/pacts/topology-provider.pact.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createTopologyGateway } from '../routes';

vi.mock('../repositories', () => {
  return {
    AssetsRepository: class MockAssetsRepository {
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
    OrganizationsRepository: class MockOrganizationsRepository {
      async findOrganizations() {
        return [
          {
            id: 'org-101',
            name: 'Space Systems Command',
            type: 'MILITARY_BRANCH',
            addressLine1: 'Building 2730',
            addressLine2: 'El Segundo, CA',
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

    // Mount under both gateway and direct container routes
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
          // Repository is mocked; no state setup required
        },
        'organizations exist for asset ast-101': async () => {
          // Repository is mocked; no state setup required
        },
      },
    });

    await verifier.verifyProvider();
  });
});