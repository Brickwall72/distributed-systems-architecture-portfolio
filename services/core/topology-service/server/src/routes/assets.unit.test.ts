// File: services/core/topology-service/server/src/routes/assets.unit.test.ts
import request from 'supertest';
import express from 'express';
import { vi } from 'vitest';
import { assetsRouter } from './assets.js';

// Minimal mock: Just enough data for the controller to execute successfully
vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    session: vi.fn(() => ({
      executeRead: vi.fn(async (callback) => {
        const mockTx = {
          run: vi.fn(async () => ({
            records: [
              { get: (key: string) => (key === 'id' ? 'asset-101' : 'Quantum Sensor') },
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
app.use('/assets', assetsRouter);

describe('GET /assets (Controller Behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds with a 200 OK and returns an array payload', async () => {
    const response = await request(app).get('/assets');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('successfully processes query parameters like ownerId without crashing', async () => {
    const response = await request(app).get('/assets?ownerId=org-1');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});