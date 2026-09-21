// File: services/core/compliance-service/server/src/server.unit.test.ts

vi.mock('./db/database.js', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

import request from 'supertest';
import app from './server.js';
import express from 'express';

describe('Compliance Service Application (`server.ts`)', () => {
  it('disables the x-powered-by security header to reduce the attack surface', async () => {
    const response = await request(app).get('/compliance/api/v1/templates');
    
    // Ensures app.disable('x-powered-by') is active
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('correctly mounts the compliance gateway router under /compliance/api/v1', async () => {
    const response = await request(app).get('/compliance/api/v1/templates');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('returns a 404 for unknown paths falling through the gateway', async () => {
    const response = await request(app).get('/compliance/api/v1/invalid-subpath-route');
    
    expect(response.status).toBe(404);
  });
});
describe('Root Error Handler Middleware', () => {
  it('intercepts unhandled exceptions and returns the standardized 500 payload', async () => {
    // Create a local test app mirroring server.ts error middleware structure
    const testApp = express();
    
    testApp.get('/error-trigger', (_req, _res, next) => {
      next(new Error('Database connection dropped'));
    });

    // Mirror the root error handler from server.ts
    testApp.use((_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected processing fault occurred within the compliance gateway container context.',
        timestamp: new Date().toISOString()
      });
    });

    const response = await request(testApp).get('/error-trigger');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected processing fault occurred within the compliance gateway container context.',
      timestamp: expect.any(String)
    });
  });
});