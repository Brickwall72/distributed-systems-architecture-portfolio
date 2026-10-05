// File: services/core/topology-service/server/src/routes/organizations.unit.test.ts
import request from 'supertest';
import express from 'express';
import { organizationsRouter } from './organizations.js';
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

describe('GET /organizations', () => {
  const activeSession = {
    executeRead: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabaseClient).mockReturnValue({
      session: () => activeSession,
    } as any);
  });

  const buildAppInstance = () => express().use(express.json()).use('/organizations', organizationsRouter);

  it('returns 200 with mapped organization records filtered by excludeId', async () => {
    const mockDriverRun = vi.fn().mockResolvedValue({
      records: [
        {
          get: (key: string) =>
            ({
              id: 'org-10',
              name: 'HQ Battalion',
              type: 'COMMAND',
              addressLine1: 'Building 100',
              addressLine2: 'Suite 4',
            }[key]),
        },
      ],
    });

    activeSession.executeRead.mockImplementation((tx) => tx({ run: mockDriverRun }));

    const res = await request(buildAppInstance())
      .get('/organizations')
      .query({ excludeId: 'org-99' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'org-10',
        name: 'HQ Battalion',
        type: 'COMMAND',
        addressLine1: 'Building 100',
        addressLine2: 'Suite 4',
      },
    ]);
    expect(mockDriverRun).toHaveBeenCalledWith(
      expect.stringContaining('MATCH (o:Organization)'),
      { excludeId: 'org-99' }
    );
    expect(activeSession.close).toHaveBeenCalledTimes(1);
  });

  it('defaults excludeId to null when no query string is provided', async () => {
    const mockDriverRun = vi.fn().mockResolvedValue({ records: [] });
    activeSession.executeRead.mockImplementation((tx) => tx({ run: mockDriverRun }));

    const res = await request(buildAppInstance()).get('/organizations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockDriverRun).toHaveBeenCalledWith(expect.any(String), { excludeId: null });
    expect(activeSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns 400 Bad Request when query object fails schema parsing', async () => {
    // Duplicate parameters parse as an Array, failing z.string() schema validation
    const res = await request(buildAppInstance()).get('/organizations?excludeId=org-1&excludeId=org-2');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid query parameters');
    expect(res.body).toHaveProperty('details');
    expect(getDatabaseClient).not.toHaveBeenCalled();
  });

  it('returns 500 error payload and cleans up active database session upon exception', async () => {
    activeSession.executeRead.mockRejectedValue(new Error('Cypher syntax error'));

    const res = await request(buildAppInstance()).get('/organizations');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Internal server error while fetching organizations',
    });
    expect(activeSession.close).toHaveBeenCalledTimes(1);
  });
});