// File: services/platform/pdf-generator/server/src/routes/generator/generator.unit.test.ts
import request from 'supertest';
import express from 'express';
import { router as generatorRouter } from './generator';
import * as services from '../../services';

// 1. Mock the services barrel export
vi.mock('../../services', () => ({
  generatePdfFromHtml: vi.fn(),
  uploadGeneratedDocument: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/generator', generatorRouter);

describe('pdfRouter (Controller Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mock implementations
    vi.mocked(services.generatePdfFromHtml).mockResolvedValue(
      Buffer.from('%PDF-1.4 sample content')
    );

    vi.mocked(services.uploadGeneratedDocument).mockResolvedValue({
      s3Uri: 's3://pdf-documents/system/test-uuid.pdf',
      bucket: 'pdf-documents',
      key: 'system/test-uuid.pdf',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedAt: new Date().toISOString(),
    });
  });

  it('should return 200 and application/pdf on valid HTML payload', async () => {
    const response = await request(app)
      .post('/generator')
      .send({ html: '<h1>Hello World</h1>' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe('inline; filename="document.pdf"');
    expect(response.headers['x-document-s3-uri']).toBeDefined();
    expect(services.generatePdfFromHtml).toHaveBeenCalledTimes(1);
    expect(services.uploadGeneratedDocument).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if HTML payload is missing', async () => {
    const response = await request(app).post('/generator').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Raw HTML string payload is required/);
  });

  it('should return 400 if HTML payload is not a string', async () => {
    const response = await request(app)
      .post('/generator')
      .send({ html: 12345 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Raw HTML string payload is required/);
  });

  it('should return 500 if the service layer throws an error', async () => {
    vi.mocked(services.generatePdfFromHtml).mockRejectedValueOnce(
      new Error('Puppeteer rendering crashed')
    );

    const response = await request(app)
      .post('/generator')
      .send({ html: '<h1>Fail</h1>' });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/PDF Generation Failed: Puppeteer rendering crashed/);
  });
});