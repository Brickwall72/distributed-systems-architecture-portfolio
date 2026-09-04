// File: src/__tests__/pdfService.test.ts
import { describe, it, expect } from 'vitest';
import { generatePdfFromHtml } from '../services/pdfService.js';

const mockHtml = `
  <!DOCTYPE html>
  <html>
    <head><title>LEO Constellation Report</title></head>
    <body><h1>Starlink-LEO-Mesh-4 Status</h1></body>
  </html>
`;

describe('pdfService (Unit)', () => {
  it('should render HTML to a valid PDF Buffer', async () => {
    const buffer = await generatePdfFromHtml(mockHtml, 'test-correlation-id');
    
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
  });
});