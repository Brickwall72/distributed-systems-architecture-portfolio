// File: services/platform/esign-service/server/src/server.contract.verify.test.ts
import request from 'supertest';

// 1. Hoist mock data before Vitest transforms imports
const { mockStorageResult, mockPdfBuffer } = vi.hoisted(() => ({
  mockStorageResult: {
    s3Uri: 's3://compliance-documents/org_armory_01/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
    fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  mockPdfBuffer: Buffer.from('%PDF-1.7 mock binary content'),
}));

// 2. Mock external side effects (Storage, Messaging, Cryptographic Signing)
vi.mock('./messaging/publisher', () => ({
  getESignPublisher: vi.fn(() => ({
    publishDocumentSigned: vi.fn().mockResolvedValue(undefined),
    publishDocumentRejected: vi.fn().mockResolvedValue(undefined),
  })),
  setESignPublisher: vi.fn(),
  ESignPublisher: vi.fn(),
}));

vi.mock('./services/storage', () => ({
  uploadSignedDocument: vi.fn().mockResolvedValue(mockStorageResult),
  uploadDocument: vi.fn().mockResolvedValue(mockStorageResult),
  getStorageService: vi.fn(() => ({
    uploadSignedDocument: vi.fn().mockResolvedValue(mockStorageResult),
  })),
}));

vi.mock('./services/signing', () => ({
  signDocument: vi.fn().mockResolvedValue(mockPdfBuffer),
}));

import app from './server';

const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORUSCYII=';

describe('E-Sign Server HTTP API Integration Contract (server.ts)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fulfills HTTP contract: accepts payload, orchestrates signing, and returns PDF content-type', async () => {
    const res = await request(app)
      .post('/api/v1/signature')
      .set('x-correlation-id', `esign-test-${Date.now()}`)
      .set('Content-Type', 'application/json')
      .send({
        pdfBase64: Buffer.from('%PDF-1.7 input doc').toString('base64'),
        signatureImageBase64: VALID_PNG_BASE64,
        documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        signerId: 'usr_actor_404',
        entityId: 'org_armory_01',
        documentType: 'DD-1149',
      });

    // Verify HTTP Protocol Contract
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/pdf/);
    expect(res.header['content-disposition']).toBe('inline; filename="digitally-signed-document.pdf"');
  });

  it('fulfills HTTP contract: enforces schema validation on missing body fields', async () => {
    const res = await request(app)
      .post('/api/v1/signature')
      .send({ pdfBase64: 'some-base64' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing pdfBase64 or signatureImageBase64 payload.' });
  });

  it('fulfills HTTP contract: enforces required compliance metadata fields', async () => {
    const res = await request(app)
      .post('/api/v1/signature')
      .send({
        pdfBase64: 'some-base64',
        signatureImageBase64: VALID_PNG_BASE64,
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Missing documentId, signerId, or entityId metadata required for event contract.',
    });
  });
});