// File: services/core/compliance-service/server/src/routes/templates.unit.test.ts
import request from 'supertest';
import express from 'express';
import { templateRoutes } from './templates';
import { runStandardRouteTests } from '@shared/testing';

// 1. Run standard route tests for the root manifest endpoint (GET /templates)
runStandardRouteTests({
  routeName: 'Compliance Templates Manifest',
  endpointPath: '/templates',
  router: templateRoutes,
});

// 2. Custom route tests for individual template retrieval and error paths
describe('Templates Router Individual Endpoints', () => {
  const app = express();
  app.use(express.json());
  app.use('/templates', templateRoutes);

  it('successfully returns raw HTML and text/html content-type for a valid template ID', async () => {
    const response = await request(app).get('/templates/contract-test-bare');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Minimal Contract Template');
  });

  it('returns a 404 status and error message when a requested template ID is missing', async () => {
    const response = await request(app).get('/templates/non-existent-form');

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
  });
});