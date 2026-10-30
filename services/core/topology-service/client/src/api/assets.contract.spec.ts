// File: services/core/topology-service/client/src/pacts/assets.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';
import { AssetDTOSchema, AssetDTOListSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';

const { like, arrayContaining } = MatchersV3;
const PACT_SEED = { seed: 1 };

// zocker can't generate `.trim().min()` chains, so name and owner are supplied
const mockAsset = (overrides: Parameters<typeof mockFromSchema<typeof AssetDTOSchema>>[1] = {}) =>
  mockFromSchema(AssetDTOSchema, { name: 'AN/PRC-117G', currentOwnerId: 'org-1', ...overrides }, PACT_SEED);

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  cors: true, // Enable automatic CORS handling for mock server
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Topology Client -> Topology Server Contract (Assets API)', () => {
  it('receives a valid AssetDTO collection via production apiClient', async () => {
    const asset = mockAsset({ id: 'ast-101' });

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
        body: arrayContaining(like(asset)),
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
      const body = AssetDTOListSchema.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(asset.id);
    });
  });

  it('successfully registers a new asset via POST createAsset endpoint', async () => {
    const newAssetPayload = mockAsset({ id: 'ast-202', name: 'AN/PRC-152A' });

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
      expect(AssetDTOSchema.parse(response.body)).toEqual(expect.objectContaining({ id: newAssetPayload.id }));
    });
  });
});