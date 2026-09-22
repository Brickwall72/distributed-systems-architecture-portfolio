// File: services/platform/esign-service/server/src/server.contract.server.test.ts
import request from 'supertest';
import app from './server.js';

// Minimal valid 1-page Base64 PDF to prevent pdf-lib from crashing
const MINIMAL_PDF_BASE64 = 'JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxMjUgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5NAolJUVPRgo=';

// Minimal valid 1x1 transparent Base64 PNG
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Mock fs to bypass the cryptographic seal attempt, keeping everything else integrated via server.ts
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false), // Pretend p12 cert doesn't exist to skip @signpdf
  };
});

describe('E-Sign Server Contract Tests (server.ts)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fulfills the API contract through the fully configured Express app', async () => {
    const correlationId = `esign-req-${Date.now()}`;

    const res = await request(app)
      .post('/api/v1/')
      .set('x-correlation-id', correlationId)
      .set('Content-Type', 'application/json')
      .send({
        pdfBase64: MINIMAL_PDF_BASE64,
        signatureImageBase64: MINIMAL_PNG_BASE64,
      })
      .responseType('blob'); // Handles binary PDF responses correctly

    // Assert Status Contract
    expect(res.status).toBe(200);

    // Assert Headers Contract
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toBe('inline; filename="digitally-signed-document.pdf"');

    // Assert Body Contract (should be binary PDF data starting with %PDF)
    const responseBuffer = res.body as Buffer;
    expect(Buffer.isBuffer(responseBuffer)).toBe(true);
    expect(responseBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('handles missing payload parameters correctly via server middleware', async () => {
    const res = await request(app)
      .post('/api/v1/')
      .send({ pdfBase64: MINIMAL_PDF_BASE64 }); // Missing signatureImageBase64

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing pdfBase64 or signatureImageBase64 payload.' });
  });
});