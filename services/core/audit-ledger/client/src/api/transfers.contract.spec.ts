// File: services/core/audit-ledger/client/src/api/transfers.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';
import { transferSummarySchema, transfersRoutes } from 'audit-shared';
import { mockFromSchema } from '@shared/testing';

const { like, arrayContaining, string } = MatchersV3;

const provider = new PactV3({
  consumer: 'audit-client',
  provider: 'audit-server',
  cors: true,
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Audit Client -> Audit Server Contract (Transfers API)', () => {
  // Same seed as the provider verification so optional keys line up with the committed examples
  const PACT_SEED = 1;
  const exampleSummary = (overrides = {}) => mockFromSchema(transferSummarySchema, overrides, { seed: PACT_SEED });

  it('returns the combined list of transfer summaries', async () => {
    provider
      .given('ledger transfers exist')
      .uponReceiving('a request to list ledger transfers')
      .withRequest({
        method: 'GET',
        path: '/audit/api/v1/transfers',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: arrayContaining(like(exampleSummary())),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTransfers({
        overrideClientOptions: { baseUrl: `${mockServer.url}/audit/api/v1` },
      });

      expect(response.status).toBe(200);
      expect(transfersRoutes.getTransfers.responses[200].parse(response.body)).toHaveLength(1);
    });
  });

  it('filters transfer summaries by status with pagination', async () => {
    provider
      .given('sealed ledger transfers exist')
      .uponReceiving('a request to list sealed ledger transfers')
      .withRequest({
        method: 'GET',
        path: '/audit/api/v1/transfers',
        query: { status: 'SEALED', limit: '10', offset: '0' },
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: arrayContaining(like(exampleSummary({ status: 'SEALED' }))),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTransfers({
        query: { status: 'SEALED', limit: 10, offset: 0 },
        overrideClientOptions: { baseUrl: `${mockServer.url}/audit/api/v1` },
      });

      expect(response.status).toBe(200);
      const body = transfersRoutes.getTransfers.responses[200].parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe('SEALED');
    });
  });

  it('returns the error contract when the ledger cannot be read', async () => {
    provider
      .given('the ledger service is failing')
      .uponReceiving('a request to list ledger transfers while the ledger is failing')
      .withRequest({
        method: 'GET',
        path: '/audit/api/v1/transfers',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: string('Internal server error.'),
          code: string('INTERNAL_SERVER_ERROR'),
          timestamp: string('2026-01-01T00:00:00.000Z'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTransfers({
        overrideClientOptions: { baseUrl: `${mockServer.url}/audit/api/v1` },
      });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    });
  });
});
