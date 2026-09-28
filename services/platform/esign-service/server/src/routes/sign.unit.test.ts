// File: services/platform/esign-service/server/src/routes/sign.unit.test.ts
import request from 'supertest';
import express from 'express';
import { esignRouter } from './sign';

// 1. Hoist mock functions
const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

const { mockPdfLoad } = vi.hoisted(() => ({
  mockPdfLoad: vi.fn(),
}));

const { mockPublishDocumentSigned, mockGetESignPublisher } = vi.hoisted(() => ({
  mockPublishDocumentSigned: vi.fn().mockResolvedValue(undefined),
  mockGetESignPublisher: vi.fn(),
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

// 3. Mock publisher module
vi.mock('../messaging/publisher.js', () => ({
  getESignPublisher: mockGetESignPublisher,
}));

describe('E-Signature Router Unit Tests', () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v1', esignRouter);

  const validPayload = {
    pdfBase64: 'mock-pdf',
    signatureImageBase64: 'mock-png',
    documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    signerId: 'usr_4412',
    entityId: 'clr_9910',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if pdfBase64 or signatureImageBase64 is missing', async () => {
    const res = await request(app)
      .post('/api/v1/')
      .send({ pdfBase64: 'mock-pdf' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing pdfBase64 or signatureImageBase64 payload.' });
  });

  it('returns 400 if documentId, signerId, or entityId metadata is missing', async () => {
    const res = await request(app)
      .post('/api/v1/')
      .send({
        pdfBase64: 'mock-pdf',
        signatureImageBase64: 'mock-png',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Missing documentId, signerId, or entityId metadata required for event contract.',
    });
  });

  it('processes the PDF, publishes NATS event, and returns 200 without cert', async () => {
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

    mockExistsSync.mockReturnValue(false);
    mockGetESignPublisher.mockReturnValue({
      publishDocumentSigned: mockPublishDocumentSigned,
    });

    const res = await request(app)
      .post('/api/v1/')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toBe('inline; filename="digitally-signed-document.pdf"');
    expect(res.body).toEqual(Buffer.from([1, 2, 3]));

    // Assert event dispatching interaction
    expect(mockPublishDocumentSigned).toHaveBeenCalledWith({
      data: {
        documentId: validPayload.documentId,
        signerId: validPayload.signerId,
        entityId: validPayload.entityId,
        status: 'SIGNED',
      },
      correlationId: null,
    });
  });

  it('catches thrown errors and returns 500', async () => {
    mockPdfLoad.mockRejectedValue(new Error('PDF parsing failed'));
    mockGetESignPublisher.mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/v1/')
      .send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'E-Signature processing failed: PDF parsing failed' });
  });
});