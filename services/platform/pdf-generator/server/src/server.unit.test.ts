// File: services/platform/pdf-generator/server/src/server.unit.test.ts
import request from 'supertest';
import app from './server.js';

describe('PDF Generator Server Bootstrap (Integration)', () => {
  it('should return 200 HEALTHY from the shared telemetry health endpoint', async () => {
    const res = await request(app).get('/pdf/api/v1/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'HEALTHY',
      service: 'pdf-server',
      timestamp: expect.any(String),
    });
  });
});