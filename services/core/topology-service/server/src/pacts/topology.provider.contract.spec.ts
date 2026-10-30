// File: services/core/topology-service/server/src/pacts/topology.provider.contract.spec.ts
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { createTopologyGateway } from '../routes';

vi.mock('../repositories', async () => {
  const { mockFromSchema } = await import('@shared/testing');
  const { AssetDTOSchema } = await import('@contracts/topology');
  const { assetEntitySchema } = await import('../domain');
  // Same seed as the consumer specs so optional keys line up with the committed pact examples.
  const seed = { seed: 1 };
  const graphAsset = mockFromSchema(AssetDTOSchema, { id: 'asset-1', name: 'Probe Mk I', currentOwnerId: 'org-1' }, seed);

  return {
    AssetsRepository: class MockAssetsRepository {
      async findAssets() {
        return [mockFromSchema(assetEntitySchema, { id: 'ast-101', currentOwnerId: 'org-1' }, seed)];
      }

      async createAsset(dto: any) {
        const { name: _name, ...entity } = dto;
        return mockFromSchema(assetEntitySchema, entity, seed);
      }
    },
    OrganizationsRepository: class MockOrganizationsRepository {
      async findOrganizations() {
        return [
          {
            id: 'org-101',
            name: 'Space Systems Command',
            type: 'GOV_AGENCY',
            addressLine1: 'Building 2730',
            addressLine2: 'El Segundo, CA',
          },
        ];
      }
    },
    GraphRepository: class MockGraphRepository {
      async getGraph() {
        return {
          timestamp: new Date().toISOString(),
          organizations: [
            {
              id: 'org-1',
              name: 'Alpha Command',
              type: 'CONTRACTOR',
              addressLine1: 'Pad 39-B',
            },
          ],
          assets: [graphAsset],
          activeTransfers: [
            {
              requisitionNumber: 'REQ-001',
              date: '20261020',
              type: 'PHYSICAL_TRANSFER',
              status: 'IN_TRANSIT',
              assets: [],
            },
          ],
          custodyLinks: [
            {
              orgId: 'org-1',
              assetId: 'asset-1',
            },
          ],
        };
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
        'organization org-1 exists': async () => {
          // Repository is mocked; no state setup required
        },
        'organizations exist for asset ast-101': async () => {
          // Repository is mocked; no state setup required
        },
        'topology graph network nodes exist': async () => {
          // Repository is mocked; no state setup required
        },
      },
    });

    await verifier.verifyProvider();
  });
});