// File: services/core/topology-service/server/src/routes/organizations.unit.test.ts
import request from 'supertest';
import express from 'express';
import { vi } from 'vitest';
import { organizationsRouter } from './organizations.js';

// Minimal mock: We don't care about schema shape here, just that the route executes
vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    session: vi.fn(() => ({
      executeRead: vi.fn(async (callback) => {
        const mockTx = {
          run: vi.fn(async () => ({
            records: [
              { get: (key: string) => (key === 'id' ? 'org-1' : 'Alpha Corp') },
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

describe('GET /organizations (Controller Behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds with a 200 OK and returns an array payload', async () => {
    const response = await request(app).get('/organizations');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('successfully processes query parameters like excludeId without crashing', async () => {
    const response = await request(app).get('/organizations?excludeId=org-1');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});