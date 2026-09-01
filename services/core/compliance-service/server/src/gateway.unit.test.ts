// File: services/core/compliance-service/server/src/gateway.unit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { complianceGateway } from './gateway.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Unit Test: Compliance Backend Entry Coordinator Gate (gateway)', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.resetAllMocks();
    // CLEANED: Removed vi.useFakeTimers() to eliminate Supertest queue locking conflicts

    app = express();
    app.use(express.json());
    app.use('/api/v1/compliance', complianceGateway);
  });

  it('should reject requests missing the required X-Correlation-ID header with a 400 fault matrix', async () => {
    const response = await request(app)
      .post('/api/v1/compliance/verify')
      .send({ sourceAssetId: 'asset-1', targetAssetId: 'asset-2' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('MISSING_CORRELATION_TOKEN');
    expect(response.body).toHaveProperty('timestamp');
  });

    it('should enforce an immediate short-circuit abort if an upstream network check hits a timeout limit', async () => {
    const validUuid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    
    // CORRECTED: Pass the exact message string your backend logic actively evaluates for a 504 status
    mockFetch.mockImplementation(() => {
      return Promise.reject(new Error('TIMEOUT_LIMIT_EXCEEDED'));
    });

    const response = await request(app)
      .post('/api/v1/compliance/verify')
      .set('X-Correlation-ID', validUuid)
      .send({
        sourceAssetId: 'a3b48270-1283-4a11-bca9-593ef2718902',
        targetAssetId: 'f3b48270-1283-4a11-bca9-593ef2718902',
        actionContext: 'SQUADRON_HANDOVER'
      });

    // Asserts compliance coordinator safely intercepts the failure and yields a 504 gateway timeout
    expect(response.status).toBe(504);
    expect(response.body.errorCode).toBe('VALIDATION_GATE_TIMEOUT');
    expect(response.body.correlationId).toBe(validUuid);
  });
});
