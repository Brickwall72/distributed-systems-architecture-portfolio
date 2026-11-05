// File: services/platform/auth-service/client/src/api/auth.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'node:path';
import { identitySchema, ROLE } from '@contracts/auth';
import { mockFromSchema } from '@shared/testing';
import { apiClient } from './client';

const { like, eachLike, string, iso8601DateTimeWithMillis } = MatchersV3;

const provider = new PactV3({
  consumer: 'auth-client',
  provider: 'auth-server',
  cors: true,
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

const identity = mockFromSchema(identitySchema, {
  id: 'usr_ksc_gov',
  orgId: 'org-ksc-gov',
  roles: [ROLE.ORG_MEMBER],
  signerId: 'usr_ksc_gov',
});

// orgId is null for the auditor, so the listing contract leaves it out of the type-matched example.
const { orgId: _orgId, ...listedIdentity } = identity;

describe('Auth Client -> Auth Server Contract', () => {
  it('lists the available identities', async () => {
    provider
      .given('dev login is enabled')
      .uponReceiving('a request to list identities')
      .withRequest({ method: 'GET', path: '/auth/api/v1/identities', headers: { Accept: 'application/json' } })
      .willRespondWith({ status: 200, headers: { 'Content-Type': 'application/json' }, body: eachLike(like(listedIdentity)) });

    await provider.executeTest(async (mockServer) => {
      const res = await apiClient.getIdentities({ overrideClientOptions: { baseUrl: `${mockServer.url}/auth/api/v1` } });
      expect(res.status).toBe(200);
    });
  });

  it('mints a session for a known identity', async () => {
    provider
      .given('dev login is enabled')
      .uponReceiving('a request to create a session')
      .withRequest({
        method: 'POST',
        path: '/auth/api/v1/session',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: { identityId: identity.id },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          accessToken: string('header.payload.signature'),
          expiresAt: iso8601DateTimeWithMillis(),
          identity: like(listedIdentity),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const res = await apiClient.createSession({
        body: { identityId: identity.id },
        overrideClientOptions: { baseUrl: `${mockServer.url}/auth/api/v1` },
      });
      expect(res.status).toBe(200);
    });
  });

  it('returns 404 for an unknown identity', async () => {
    provider
      .given('dev login is enabled')
      .uponReceiving('a request to create a session for an unknown identity')
      .withRequest({
        method: 'POST',
        path: '/auth/api/v1/session',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: { identityId: 'nobody' },
      })
      .willRespondWith({ status: 404, headers: { 'Content-Type': 'application/json' }, body: { error: string('Unknown identity') } });

    await provider.executeTest(async (mockServer) => {
      const res = await apiClient.createSession({
        body: { identityId: 'nobody' },
        overrideClientOptions: { baseUrl: `${mockServer.url}/auth/api/v1` },
      });
      expect(res.status).toBe(404);
    });
  });
});
