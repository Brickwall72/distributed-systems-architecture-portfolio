// File: services/core/topology-service/client/src/api/organizations/organizations.unit.test.ts
import path from 'node:path';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { fetchOrganizations } from './organizations';

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('fetchOrganizations Pact Contract', () => {
  it('requests organizations with parentId filtering criteria', () => {
    const expectedOrganizationSchema = {
      id: like('org-101'),
      name: like('1st Battalion'),
      type: like('CONTRACTOR'),
    };

    provider
      .given('organizations exist under parent org-parent-101')
      .uponReceiving('a request for child organizations')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/organizations',
        query: {
          parentId: 'org-parent-101',
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
        body: eachLike(expectedOrganizationSchema),
      });

    return provider.executeTest(async (mockServer) => {
      const originalFetch = global.fetch;
      global.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = input.toString();
        const targetUrl = `${mockServer.url}${urlString}`;
        return originalFetch(targetUrl, init);
      };

      try {
        const orgs = await fetchOrganizations({ parentId: 'org-parent-101' });

        expect(orgs).toHaveLength(1);
        expect(orgs[0]).toHaveProperty('id');
        expect(orgs[0]).toHaveProperty('name');
        expect(orgs[0]).toHaveProperty('type');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});