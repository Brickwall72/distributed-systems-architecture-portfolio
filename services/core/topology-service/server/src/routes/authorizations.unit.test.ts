// File: services/core/topology-service/server/src/routes/authorizations.unit.test.ts
import request from 'supertest';
import express from 'express';
import { authorizationsRouter } from './authorizations.js';
import { mockState } from '../utils/test-setup.js';

const app = express();
app.use(express.json());
app.use('/authorizations', authorizationsRouter);

describe('POST /authorizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.currentState = 'authorizations'; // Switch global mock to return authorization counts
  });

  it('rejects requests missing the correlation header', async () => {
    const response = await Promise.resolve(
      request(app)
        .post('/authorizations')
        .send({
          senderOrgId: 'org-1',
          receiverOrgId: 'org-2',
          assetId: 'asset-1',
          actionContext: 'CUSTODY_TRANSFER',
        })
    );

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('MISSING_CORRELATION_TOKEN');
  });

  it('authorizes a valid custody transfer payload', async () => {
    const response = await Promise.resolve(
      request(app)
        .post('/authorizations')
        .set('X-Correlation-ID', 'test-corr-123')
        .send({
          senderOrgId: 'org-1',
          receiverOrgId: 'org-2',
          assetId: 'asset-1',
          actionContext: 'CUSTODY_TRANSFER',
        })
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('AUTHORIZED');
    expect(response.body.correlationId).toBe('test-corr-123');
  });
});