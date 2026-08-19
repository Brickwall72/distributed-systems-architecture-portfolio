import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Stub the stream router entirely so index.ts can be tested completely in isolation
vi.mock('./routes/stream.js', () => {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.status(200).json({ mocked: true });
  });
  return { streamRouter: router };
});

describe('Unit Test: Express Server Initialization (index)', () => {
  it('should respond with telemetry data on the /health endpoint', async () => {
    // Import dynamically to capture process environment variables during execution
    const { default: app } = await import('./index.js');
    
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'HEALTHY',
      service: 'pdf-viewer'
    });
  });

  it('should permanently mask framework fingerprinting headers to prevent disclosure', async () => {
    const { default: app } = await import('./index.js');
    
    const response = await request(app).get('/health');
    
    // Asserts that your app.disable('x-powered-by') configuration is actively functional
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
