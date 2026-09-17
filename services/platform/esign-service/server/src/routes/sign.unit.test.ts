// File: services/platform/esign-service/server/src/routes/sign.unit.test.ts
import request from 'supertest';
import express from 'express';
import { esignRouter } from './sign';

// 1. Hoist mock functions to ensure they are available during module mocking
const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

const { mockPdfLoad } = vi.hoisted(() => ({
  mockPdfLoad: vi.fn(),
}));

// 2. Mock node:fs explicitly
vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('@shared/telemetry', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createHealthCheck: vi.fn(() => (_req: any, res: any) => res.status(200).send('OK')),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: { load: mockPdfLoad },
  rgb: vi.fn(),
}));

vi.mock('@signpdf/signpdf', () => ({ SignPdf: vi.fn() }));
vi.mock('@signpdf/signer-p12', () => ({ P12Signer: vi.fn() }));

describe('E-Signature Router Unit Tests', () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v1/esign', esignRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if pdfBase64 or signatureImageBase64 is missing', async () => {
    const res = await request(app)
      .post('/api/v1/esign/')
      .send({ pdfBase64: 'mock-pdf' }); // Missing signatureImageBase64

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing pdfBase64 or signatureImageBase64 payload.' });
  });

  it('processes the PDF and returns 200 without cryptographic seal if cert is missing', async () => {
    // Setup pdf-lib mocks for a successful run
    const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockPdfLoad.mockResolvedValue({
      getPages: vi.fn().mockReturnValue([{
        getSize: vi.fn().mockReturnValue({ width: 600 }),
        drawImage: vi.fn(),
        drawText: vi.fn(),
      }]),
      embedPng: vi.fn().mockResolvedValue({}),
      save: mockSave,
    } as any);

    // Mock fs so it fails to find the certificate
    mockExistsSync.mockReturnValue(false);

    const res = await request(app)
      .post('/api/v1/esign/')
      .send({ pdfBase64: 'mock-pdf', signatureImageBase64: 'mock-png' });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toBe('inline; filename="digitally-signed-document.pdf"');
    
    // The response body should be the binary buffer from our mockSave
    expect(res.body).toEqual(Buffer.from([1, 2, 3]));
  });

  it('catches thrown errors and returns 500', async () => {
    mockPdfLoad.mockRejectedValue(new Error('PDF parsing failed'));

    const res = await request(app)
      .post('/api/v1/esign/')
      .send({ pdfBase64: 'bad-pdf', signatureImageBase64: 'bad-png' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'E-Signature processing failed: PDF parsing failed' });
  });
});