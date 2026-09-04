// File: services/platform/pdf-generator/server/src/index.unit.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('PDF Generator Server Bootstrap (Integration)', () => {
  it('should return 200 HEALTHY from the shared telemetry health endpoint', async () => {
    const res = await request(app).get('/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'HEALTHY',
      service: 'pdf-generator',
      timestamp: expect.any(String),
    });
  });

  it('should include CORS headers for allowed client shells', async () => {
    const response = await request(app)
      .options('/api/v1/pdf/generate')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});