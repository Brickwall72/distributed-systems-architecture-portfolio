// File: services/core/topology-service/server/src/utils/test-setup.ts

/*
 * Shared test bootstrap for the server suite.
 * Adds the DOM matchers used by the component-level assertions.
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// 1. Shared state controller that unit tests and contract tests can mutate
export const mockState = {
  currentState: 'assets' as 'organizations' | 'entities' | 'assets' | 'authorizations',
};

const { mockSession } = vi.hoisted(() => {
  return {
    mockSession: vi.fn(() => ({
      executeRead: vi.fn(async (callback: any) => {
        return callback({
          run: vi.fn(async () => {
            // State-driven routing for contract tests and advanced unit tests
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
            if (mockState.currentState === 'authorizations') {
              return {
                records: [
                  { get: (key: string) => (key === 'authorizedCount' ? 1 : 0) },
                ],
              };
            }
            // Default fallback / 'assets' state (keeps standard unit tests green)
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
          }),
        });
      }),
      close: vi.fn(async () => {}),
    })),
  };
});

vi.mock('../topologyDatabase.js', () => ({
  initializeDatabaseConnection: async () => ({}),
  terminateDatabaseClient: async () => ({}),
  getDatabaseClient: () => ({ session: mockSession }),
}));