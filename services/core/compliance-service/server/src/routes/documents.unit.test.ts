// File: services/core/compliance-service/server/src/routes/documents.unit.test.ts
import request from 'supertest';
import express from 'express';
import documentsRouter from './documents.js';

// Hoist mock functions
const { mockUploadComplianceDocument } = vi.hoisted(() => ({
  mockUploadComplianceDocument: vi.fn(),
}));

const { mockPoolQuery } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
}));

// Mocks must match the exact relative path used in documents.ts
vi.mock('../services/storage.js', () => ({
  uploadComplianceDocument: mockUploadComplianceDocument,
}));

vi.mock('../db/database.js', () => ({
  pool: {
    query: mockPoolQuery,
  },
}));

vi.mock('@shared/telemetry', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe('Compliance Documents Router Unit Tests', () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v1/documents', documentsRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /compliance/api/v1/documents/', () => {
    it('returns 400 if pdfBase64 is missing', async () => {
      const res = await request(app)
        .post('/api/v1/documents/')
        .send({}); // Missing pdfBase64

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Missing required field: pdfBase64.' });
    });

    it('successfully uploads document to MinIO and inserts record into Postgres', async () => {
      mockUploadComplianceDocument.mockResolvedValue('s3://compliance-documents/transfer-approval/test-doc-123.pdf');
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 42, created_at: '2026-09-12T19:00:00.000Z' }],
      });

      const res = await request(app)
        .post('/api/v1/documents/')
        .send({
          pdfBase64: 'dGVzdC1wZGY=',
          documentType: 'transfer-approval',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        id: 42,
        documentId: expect.any(String),
        documentType: 'transfer-approval',
        s3Uri: 's3://compliance-documents/transfer-approval/test-doc-123.pdf',
        createdAt: '2026-09-12T19:00:00.000Z',
      });

      expect(mockUploadComplianceDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'transfer-approval'
      );
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO compliance_documents'),
        [expect.any(String), 'transfer-approval', 's3://compliance-documents/transfer-approval/test-doc-123.pdf']
      );
    });

    it('returns 500 if storage upload throws an error', async () => {
      mockUploadComplianceDocument.mockRejectedValue(new Error('MinIO connection failed'));

      const res = await request(app)
        .post('/api/v1/documents/')
        .send({
          pdfBase64: 'dGVzdC1wZGY=',
        });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal storage failure: MinIO connection failed' });
    });
  });

  describe('GET /compliance/api/v1/documents/', () => {
    it('successfully retrieves compliance documents dataset', async () => {
      const mockRows = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          document_type: 'DD1149-asset-transfer.pdf',
          status: 'Pending',
          created_at: '2026-09-12T19:00:00.000Z',
        },
      ];
      mockPoolQuery.mockResolvedValue({ rows: mockRows });

      const res = await request(app)
        .get('/api/v1/documents/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRows);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM compliance_documents')
      );
    });

    it('returns 500 if database query fails during retrieval', async () => {
      mockPoolQuery.mockRejectedValue(new Error('Database connection lost'));

      const res = await request(app)
        .get('/api/v1/documents/');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to retrieve compliance_documents dataset' });
    });
  });
});