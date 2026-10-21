// File: services/core/topology-service/client/src/pacts/assets.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';

const { like, string, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  cors: true, // Enable automatic CORS handling for mock server
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Topology Client -> Topology Server Contract (Assets API)', () => {
  it('receives a valid AssetDTO collection via production apiClient', async () => {
    provider
      .given('assets exist for organization org-1')
      .uponReceiving('a request to fetch assets for org-1 with includeInTransit filter')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/assets',
        query: {
          filterOwnerId: 'org-1',
          includeInTransit: 'true',
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: arrayContaining(
          like({
            id: string('ast-101'),
            name: string('AN/PRC-117G'),
            nomenclature: string('AN/PRC-117G'),
            serialNumber: string('SN-9982'),
            status: string('AVAILABLE'),
            currentOwnerId: string('org-1'),
          })
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getAssets({
        query: {
          filterOwnerId: 'org-1',
          includeInTransit: true,
        },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/topology/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as Array<{ id: string; status: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('ast-101');
      expect(body[0].status).toBe('AVAILABLE');
    });
  });

  it('successfully registers a new asset via POST createAsset endpoint', async () => {
    const newAssetPayload = {
      id: 'ast-202',
      name: 'AN/PRC-152A',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      status: 'AVAILABLE' as const,
      currentOwnerId: 'org-1',
    };

    provider
      .given('organization org-1 exists')
      .uponReceiving('a request to create a new asset assigned to org-1')
      .withRequest({
        method: 'POST',
        path: '/topology/api/v1/assets',
        headers: {
          'Content-Type': 'application/json',
        },
        body: newAssetPayload,
      })
      .willRespondWith({
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: like(newAssetPayload),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.createAsset({
        body: newAssetPayload,
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/topology/api/v1`,
        },
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({ id: 'ast-202', status: 'AVAILABLE' }));
    });
  });
});