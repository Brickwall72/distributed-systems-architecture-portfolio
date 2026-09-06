// File: services/core/topology-service/server/src/routes/organizations.unit.test.ts
import request from 'supertest';
import express from 'express';
import { organizationsRouter } from './organizations.js';

// Mock the database client module
vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    session: vi.fn(() => ({
      executeRead: vi.fn(async (callback) => {
        // Simulate a mock Neo4j transaction execution result
        const mockTx = {
          run: vi.fn(async () => ({
            records: [
              { get: (key: string) => (key === 'id' ? 'org-1' : 'Alpha Corp') },
              { get: (key: string) => (key === 'id' ? 'org-2' : 'Beta Industries') },
            ],
          })),
        };
        return callback(mockTx);
      }),
      close: vi.fn(async () => {}),
    })),
  })),
}));

const app = express();
app.use(express.json());
app.use('/organizations', organizationsRouter);

describe('GET /organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of organizations successfully', async () => {
    const response = await request(app).get('/organizations');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'org-1', name: 'Alpha Corp' },
      { id: 'org-2', name: 'Beta Industries' },
    ]);
  });

  it('accepts an optional excludeId query parameter', async () => {
    const response = await request(app).get('/organizations?excludeId=org-1');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});