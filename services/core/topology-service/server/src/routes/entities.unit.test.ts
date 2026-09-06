// File: services/core/topology-service/server/src/routes/entities.unit.test.ts
import request from 'supertest';
import express from 'express';
import { entitiesRouter } from './entities.js';

vi.mock('../topologyDatabase.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    session: vi.fn(() => ({
      executeRead: vi.fn(async (callback) => {
        const mockTx = {
          run: vi.fn(async () => ({
            records: [
              {
                get: (key: string) => {
                  const recordData: Record<string, string> = {
                    requisitionNumber: 'REQ-2026-001',
                    transferDate: '20260905',
                    senderOrgId: 'org-1',
                    senderName: 'Alpha Corp',
                    receiverOrgId: 'org-2',
                    receiverName: 'Beta Industries',
                    assetId: 'asset-101',
                    assetNomenclature: 'Quantum Sensor',
                    serialNumber: 'SN-998877',
                  };
                  return recordData[key];
                },
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
app.use('/entities', entitiesRouter);

describe('GET /entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a directory of custody transfer records successfully', async () => {
    const response = await request(app)
      .get('/entities')
      .set('X-Correlation-ID', 'test-corr-entities');

    expect(response.status).toBe(200);
    expect(response.body.transfers).toHaveLength(1);
    expect(response.body.transfers[0].requisitionNumber).toBe('REQ-2026-001');
    expect(response.body.transfers[0].senderName).toBe('Alpha Corp');
  });
});