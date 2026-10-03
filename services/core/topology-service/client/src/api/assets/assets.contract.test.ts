// File: services/core/topology-service/client/src/api/assets/assets.contract.test.ts
import path from 'node:path';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { fetchAssets } from './assets';

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('fetchAssets Pact Contract', () => {
  it('requests assets with owner filtering criteria', () => {
    const expectedAssetSchema = {
      id: like('ast-1001'),
      nomenclature: like('AN/PRC-117G'),
      serialNumber: like('SN-987654'),
      currentOwnerId: like('org-101'),
    };

    provider
      .given('assets exist for owner org-101')
      .uponReceiving('a request for filtered assets')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/assets',
        query: {
          ownerId: 'org-101',
          excludeOwnerId: 'org-202',
        },
        headers: {
          Accept: 'application/json',
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: eachLike(expectedAssetSchema),
      });

    return provider.executeTest(async (mockServer) => {
      // Intercept fetch to route relative paths to Pact's dynamic localhost server
      const originalFetch = global.fetch;
      global.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = input.toString();
        const targetUrl = `${mockServer.url}${urlString}`;
        return originalFetch(targetUrl, init);
      };

      try {
        const assets = await fetchAssets({ ownerId: 'org-101', excludeOwnerId: 'org-202' });
        
        expect(assets).toHaveLength(1);
        expect(assets[0]).toHaveProperty('id');
        expect(assets[0]).toHaveProperty('nomenclature');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});