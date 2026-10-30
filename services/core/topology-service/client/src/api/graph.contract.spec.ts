// File: services/core/topology-service/client/src/pacts/graph.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';
import { AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';

const { like, string, regex, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  cors: true, // Enable automatic CORS handling for mock server
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Topology Client -> Topology Server Contract (Graph API)', () => {
  it('receives a valid GraphDTO projection via production apiClient', async () => {
    const asset = mockFromSchema(AssetDTOSchema, { id: 'asset-1', name: 'Probe Mk I', currentOwnerId: 'org-1' }, { seed: 1 });

    provider
      .given('topology graph network nodes exist')
      .uponReceiving('a request to fetch the complete topology network graph projection')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/graph',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: like({
          timestamp: string('2026-10-20T21:00:00.000Z'),
          organizations: arrayContaining(
            like({
              id: string('org-1'),
              name: string('Alpha Command'),
              type: regex('(CONTRACTOR|GOV_AGENCY)', 'CONTRACTOR'),
              addressLine1: string('Pad 39-B'),
            })
          ),
          assets: arrayContaining(like(asset)),
          activeTransfers: arrayContaining(
            like({
              requisitionNumber: string('REQ-001'),
              date: string('20261020'),
              type: string('PHYSICAL_TRANSFER'),
              status: string('IN_TRANSIT'),
            })
          ),
          custodyLinks: arrayContaining(
            like({
              orgId: string('org-1'),
              assetId: string('asset-1'),
            })
          ),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getGraph({
        query: undefined,
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/topology/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as { timestamp: string; organizations: unknown[] };
      expect(body).toHaveProperty('timestamp');
      expect(body.organizations.length).toBeGreaterThan(0);
    });
  });
});