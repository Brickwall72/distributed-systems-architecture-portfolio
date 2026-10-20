// File: services/core/topology-service/server/src/routes/entities.unit.test.ts
import request from 'supertest';
import express from 'express';
import { entitiesRouter } from './entities';

vi.mock('../topologyDatabase', () => ({
  getDatabaseClient: () => ({
    session: () => ({
      executeRead: async (callback: any) => {
        const mockTx = {
          run: async () => ({
            records: [
              {
                get: (key: string) => {
                  if (key === 'topologyGraph') {
                    return {
                      organizations: [
                        { id: 'org-1', name: 'Lockheed Martin Space', type: 'CONTRACTOR', addressLine1: 'Pad 1', addressLine2: '' }
                      ],
                      assets: [
                        { id: 'asset-1', name: 'Probe', nomenclature: 'Probe Mk I', serialNumber: '01', type: 'PROBE', status: 'IN_TRANSIT' }
                      ],
                      activeTransfers: [
                        {
                          requisitionNumber: 'DD1149-9988',
                          date: '20260915',
                          type: 'PHYSICAL_TRANSFER',
                          status: 'IN_TRANSIT',
                          senderOrgId: 'org-1',
                          senderName: 'Lockheed Martin Space',
                          receiverOrgId: 'org-2',
                          receiverName: 'KSC',
                          assetId: 'asset-1',
                          assetNomenclature: 'Probe Mk I',
                          serialNumber: '01',
                          invStatus: 'IN_TRANSIT'
                        }
                      ],
                      custodyLinks: []
                    };
                  }
                  return null;
                },
              },
            ],
          }),
        };
        return callback(mockTx);
      },
      close: async () => {},
    }),
  }),
}));

const app = express();
app.use(express.json());
app.use('/entities', entitiesRouter);

describe('GET /entities', () => {
  it('returns the full topology graph payload successfully with active transfers', async () => {
    const response = await request(app)
      .get('/entities')
      .set('X-Correlation-ID', 'test-corr-entities');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('organizations');
    expect(response.body).toHaveProperty('assets');
    expect(response.body).toHaveProperty('activeTransfers');
    expect(response.body).toHaveProperty('custodyLinks');
    expect(response.body.activeTransfers).toHaveLength(1);
    expect(response.body.activeTransfers[0].requisitionNumber).toBe('DD1149-9988');
    expect(response.body.activeTransfers[0].status).toMatch(/PARTIALLY_COMPLETED|IN_TRANSIT/);
  });
});