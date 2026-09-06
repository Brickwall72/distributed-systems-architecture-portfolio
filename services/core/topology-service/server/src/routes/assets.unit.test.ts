// File: services/core/topology-service/server/src/routes/assets.unit.test.ts
import request from 'supertest';
import express from 'express';
import { assetsRouter } from './assets.js';

vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    session: vi.fn(() => ({
      executeRead: vi.fn(async (callback) => {
        const mockTx = {
          run: vi.fn(async () => ({
            records: [
              { 
                get: (key: string) => {
                  const assetData: Record<string, string> = {
                    id: 'asset-101',
                    nomenclature: 'Quantum Sensor',
                    serialNumber: 'SN-998877',
                    currentOwnerId: 'org-1',
                  };
                  return assetData[key];
                } 
              },
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

describe('GET /assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of assets with projected currentOwnerId successfully', async () => {
    const response = await request(app).get('/assets');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { 
        id: 'asset-101', 
        nomenclature: 'Quantum Sensor', 
        serialNumber: 'SN-998877',
        currentOwnerId: 'org-1'
      },
    ]);
  });

  it('accepts an optional ownerId query parameter for filtering', async () => {
    const response = await request(app).get('/assets?ownerId=org-1');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toHaveProperty('currentOwnerId', 'org-1');
  });
});