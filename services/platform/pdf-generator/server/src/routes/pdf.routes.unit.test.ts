// File: services/platform/pdf-generator/server/src/routes/pdf.routes.unit.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pdfRouter } from './pdf.routes.js';

// Mock the heavy pdfService so route tests don't spin up Puppeteer and run instantly
vi.mock('../services/pdfService.js', () => ({
  generatePdfFromHtml: vi.fn().mockImplementation(async (html) => {
    if (html === 'TRIGGER_ERROR') {
      throw new Error('Simulated engine failure');
    }
    return Buffer.from('%PDF-mock-binary-data');
  }),
}));

// Spin up a minimal express app just for testing this router
const app = express();
app.use(express.json());
app.use('/api/v1/pdf', pdfRouter);

describe('pdfRouter (Controller Layer)', () => {
  it('should return 200 and application/pdf on valid HTML payload', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .set('x-correlation-id', 'test-cid-123')
      .send({ html: '<h1>Test Report</h1>' })
      .responseType('blob');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('inline; filename="document.pdf"');
    expect(response.body.toString('utf8', 0, 5)).toBe('%PDF-');
  });

  it('should return 400 if HTML payload is missing', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Raw HTML string payload is required' });
  });

  it('should return 400 if HTML payload is not a string', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({ html: 12345 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Raw HTML string payload is required' });
  });

  it('should return 500 if the service layer throws an error', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({ html: 'TRIGGER_ERROR' });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('PDF Generation Failed: Simulated engine failure');
  });
});