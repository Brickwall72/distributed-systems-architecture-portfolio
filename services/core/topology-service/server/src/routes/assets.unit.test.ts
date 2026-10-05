// File: services/core/topology-service/server/src/routes/assets.unit.test.ts
import request from 'supertest';
import express from 'express';
import { assetsRouter } from './assets.js';
import { getDatabaseClient } from '../topologyDatabase.js';

vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(),
}));

vi.mock('@shared/express', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('GET /assets', () => {
  const mockCloseSession = vi.fn().mockResolvedValue(undefined);
  const mockExecuteRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabaseClient).mockReturnValue({
      session: () => ({
        executeRead: mockExecuteRead,
        close: mockCloseSession,
      }),
    } as any);
  });

  const createTestApp = () => express().use(express.json()).use('/assets', assetsRouter);

  it('returns 200 with mapped assets and passes Cypher parameters when query succeeds', async () => {
    const mockCypherRun = vi.fn().mockResolvedValue({
      records: [
        {
          get: (field: string) => {
            const row: Record<string, any> = {
              id: 'asset-101',
              nomenclature: 'Tactical Radio',
              serialNumber: 'TR-9901',
              currentOwnerId: 'org-456',
            };
            return row[field];
          },
        },
      ],
    });

    mockExecuteRead.mockImplementation(async (transactionHandler) =>
      transactionHandler({ run: mockCypherRun })
    );

    const response = await request(createTestApp())
      .get('/assets')
      .query({ ownerId: 'org-456', excludeOwnerId: 'org-789' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'asset-101',
        nomenclature: 'Tactical Radio',
        serialNumber: 'TR-9901',
        currentOwnerId: 'org-456',
      },
    ]);
    expect(mockCypherRun).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (a:Asset)'),
      { ownerId: 'org-456', excludeOwnerId: 'org-789' }
    );
    expect(mockCloseSession).toHaveBeenCalledTimes(1);
  });

  it('omits currentOwnerId when database returns null for unassigned assets', async () => {
    const mockCypherRun = vi.fn().mockResolvedValue({
      records: [
        {
          get: (field: string) => {
            const row: Record<string, any> = {
              id: 'asset-202',
              nomenclature: 'Unassigned Receiver',
              serialNumber: 'UR-0012',
              currentOwnerId: null,
            };
            return row[field];
          },
        },
      ],
    });

    mockExecuteRead.mockImplementation(async (transactionHandler) =>
      transactionHandler({ run: mockCypherRun })
    );

    const response = await request(createTestApp()).get('/assets');

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual({
      id: 'asset-202',
      nomenclature: 'Unassigned Receiver',
      serialNumber: 'UR-0012',
    });
    expect(response.body[0]).not.toHaveProperty('currentOwnerId');
    expect(mockCloseSession).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when Zod schema validation fails for non-string query params', async () => {
    // Duplicate parameters parse as an Array, failing z.string() schema validation
    const response = await request(createTestApp()).get('/assets?ownerId=id-1&ownerId=id-2');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid query parameters',
      details: expect.any(Object),
    });
    expect(getDatabaseClient).not.toHaveBeenCalled();
  });

  it('returns 500 and releases Neo4j session when Cypher execution throws', async () => {
    mockExecuteRead.mockRejectedValue(new Error('Neo4j cluster unavailable'));

    const response = await request(createTestApp()).get('/assets');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal server error while fetching assets',
    });
    expect(mockCloseSession).toHaveBeenCalledTimes(1);
  });
});