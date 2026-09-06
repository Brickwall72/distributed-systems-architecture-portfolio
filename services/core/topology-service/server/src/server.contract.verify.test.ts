// File: services/core/topology-service/server/src/server.contract.test.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';
import { vi } from 'vitest';

// 1. Use vi.hoisted so we can safely share mutable mock state before vi.mock runs
const { mockState } = vi.hoisted(() => {
  return { mockState: { currentState: 'assets' } };
});

// 2. Mock the database layer dynamically based on mockState.currentState
vi.mock('./topologyDatabase', () => ({
  initializeDatabaseConnection: async () => ({}),
  terminateDatabaseClient: async () => ({}),
  getDatabaseClient: () => ({
    session: () => ({
      executeRead: async (callback: any) => {
        return callback({
          run: async () => {
            if (mockState.currentState === 'organizations') {
              return {
                records: [
                  {
                    get: (key: string) => {
                      const data: Record<string, any> = {
                        id: 'org-1111-lockheed',
                        name: 'Lockheed Martin Space',
                        type: 'CONTRACTOR',
                        address1: '1111 Lockheed Martin Way',
                      };
                      return data[key];
                    },
                  },
                ],
              };
            }

            if (mockState.currentState === 'entities') {
              return {
                records: [
                  {
                    get: (key: string) => {
                      const data: Record<string, any> = {
                        senderOrgId: 'org-101',
                        senderName: 'Lockheed Martin Space',
                        receiverOrgId: 'org-102',
                        receiverName: 'Space Systems Command',
                        assetId: 'asset-001',
                        assetNomenclature: 'Primary Substation Alpha',
                        serialNumber: 'SN-12345',
                        requisitionNumber: 'DD1149-9988',
                        transferDate: '2026-09-06',
                      };
                      return data[key];
                    },
                  },
                ],
              };
            }

            // Default fallback / 'assets' state
            return {
              records: [
                {
                  get: (key: string) => {
                    const data: Record<string, any> = {
                      id: 'asset-uuid-001',
                      nomenclature: 'Primary Substation Alpha',
                      serialNumber: 'SN-12345',
                      currentOwnerId: 'org-uuid-101',
                    };
                    return data[key];
                  },
                },
              ],
            };
          },
        });
      },
      close: async () => {},
    }),
  }),
}));

import app from './server';

describe('Pact Provider Verification', () => {
  let server: any;
  const port = 8082;

  beforeAll(() => {
    server = app.listen(port);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('validates expected contracts from topology-client', async () => {
    const opts = {
      provider: 'topology-server',
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/topology-client-topology-server.json'),
      ],
      stateHandlers: {
        'assets exist in the topology graph': async () => {
          mockState.currentState = 'assets';
          return Promise.resolve();
        },
        'organizations exist in the topology graph': async () => {
          mockState.currentState = 'organizations';
          return Promise.resolve();
        },
        'topology entities and custody transfers exist': async () => {
          mockState.currentState = 'entities';
          return Promise.resolve();
        },
      },
    };

    await new Verifier(opts).verifyProvider();
    expect(true).toBe(true);
  });
});