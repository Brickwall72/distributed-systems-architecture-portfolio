// File: shared/middleware/health.unit.test.ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthCheck } from './health.js';

describe('Unit Test: Shared Telemetry Probe Middleware (health)', () => {
  it('should dynamically inject the designated service name parameter into the structured JSON payload', async () => {
    const app = express();
    // Mount the shared builder function with a specific tracking identifier
    app.get('/health', createHealthCheck('compliance-service'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('HEALTHY');
    expect(response.body.service).toBe('compliance-service');
    expect(response.body).toHaveProperty('timestamp');
  });
});
