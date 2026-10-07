// File: services/core/topology-service/client/src/pacts/organizations.pact.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from '../api';
import path from 'node:path';

const { like, string, regex, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  cors: true, // Enable automatic CORS handling for mock server
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Topology Client -> Topology Server Contract (Organizations API)', () => {
  it('receives a valid OrganizationDTO collection via production apiClient', async () => {
    provider
      .given('organizations exist for asset ast-101')
      .uponReceiving('a request to fetch organizations owning asset ast-101')
      .withRequest({
        method: 'GET',
        path: '/topology/api/v1/organizations',
        query: {
          filterOwnedId: 'ast-101',
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: arrayContaining(
          like({
            id: string('org-101'),
            name: string('Space Systems Command'),
            type: regex('(CONTRACTOR|GOV|MILITARY_BRANCH)', 'MILITARY_BRANCH'),
            addressLine1: string('Building 2730'),
            addressLine2: string('El Segundo, CA'),
          })
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getOrganizations({
        query: { filterOwnedId: 'ast-101' },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/topology/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as Array<{ id: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('org-101');
    });
  });
});