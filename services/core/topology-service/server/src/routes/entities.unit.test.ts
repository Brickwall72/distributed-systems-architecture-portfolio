// File: services/core/topology-service/server/src/routes/entities.unit.test.ts
import request from 'supertest';
import express from 'express';
import { entitiesRouter } from './entities';
import { mockState } from '../utils/test-setup'; // Import the global state manager

const app = express();
app.use(express.json());
app.use('/entities', entitiesRouter);

describe('GET /entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.currentState = 'entities'; // Tell the global mock what data to return
  });

  it('returns a directory of custody transfer records successfully', async () => {
    const response = await Promise.resolve(
      request(app)
        .get('/entities')
        .set('X-Correlation-ID', 'test-corr-entities')
    );

    expect(response.status).toBe(200);
    expect(response.body.transfers).toHaveLength(1);
    expect(response.body.transfers[0].requisitionNumber).toBe('DD1149-9988');
    expect(response.body.transfers[0].senderName).toBe('Lockheed Martin Space');
  });
});