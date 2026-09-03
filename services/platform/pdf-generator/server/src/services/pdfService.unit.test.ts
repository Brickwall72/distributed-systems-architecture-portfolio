// File: src/__tests__/pdfService.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { generatePdfFromTemplate } from './pdfService';

const mockSatelliteData = {
  constellationName: 'Starlink-LEO-Mesh-4',
  timestamp: '2026-09-02T23:45:00Z',
  satellites: [
    { satId: 'SAT-101', altitudeKm: 550, isOperational: true, encryptionProtocol: 'AES-256-GCM' },
  ],
};

describe('pdfService (Unit)', () => {
  it('should compile template and return a valid PDF Buffer', async () => {
    const buffer = await generatePdfFromTemplate('satellite-compliance-report', mockSatelliteData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    
    // Check for PDF magic header bytes ("%PDF-")
    const pdfHeader = buffer.toString('utf8', 0, 5);
    expect(pdfHeader).toBe('%PDF-');
  });

  it('should throw an error if the template file does not exist', async () => {
    await expect(
      generatePdfFromTemplate('non-existent-template', mockSatelliteData)
    ).rejects.toThrow();
  });
});

describe('POST /api/v1/pdf/generate (Integration)', () => {
  it('should return 200 and application/pdf headers for valid payload', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({
        templateId: 'satellite-compliance-report',
        data: mockSatelliteData,
      })
      .responseType('blob'); // Preserve binary response

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    
    // Check binary header signature
    const isPdf = response.body.toString('utf8', 0, 5) === '%PDF-';
    expect(isPdf).toBe(true);
  });

  it('should return 400 if data payload is missing', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({ templateId: 'satellite-compliance-report' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Data payload is required' });
  });

  it('should return 500 if requested template is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/pdf/generate')
      .send({
        templateId: 'missing-template',
        data: mockSatelliteData,
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('PDF Generation Failed');
  });
});