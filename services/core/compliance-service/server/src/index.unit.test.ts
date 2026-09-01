// File: services/core/compliance-service/server/src/index.unit.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Stub the core compliance gateway entirely so index.ts evaluates in pure isolation
vi.mock('./gateway.js', () => {
  const router = express.Router();
  router.post('/verify', (_req, res) => {
    res.status(200).json({ mocked: true });
  });
  return { complianceGateway: router };
});

describe('Unit Test: Compliance Service Root Server Initialization (index)', () => {
  it('should respond with structured telemetry data on the root /health endpoint', async () => {
    // Dynamically import to ensure clean environment separation per test pass
    const { default: app } = await import('./index.js');
    
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('HEALTHY');
    expect(response.body.service).toBe('compliance-service');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should permanently mask framework fingerprinting headers to prevent public disclosure', async () => {
    const { default: app } = await import('./index.js');
    
    const response = await request(app).get('/health');
    
    // Asserts that framework fingerprint masking is globally active
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
