// File: services/core/compliance-service/server/src/routes/documents.unit.test.ts
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import documentsRouter from './documents.js';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';

vi.mock('../db/documents.repository.js');
vi.mock('../db/database.js', () => ({
  pool: {},
}));

const app = express();
app.use(express.json());
app.use('/api/v1/documents', documentsRouter);

// Register the central error handler matching production server.js behavior
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      errorCode: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues,
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(err.status || 500).json({
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

describe('Compliance Documents Router', () => {
  const validPayload = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    document_type: 'DD-1149',
    s3_uri: 's3://compliance-documents/org_armory_01/doc_101.pdf',
    status: 'Pending',
  };

  const mockRecord = {
    ...validPayload,
    created_at: '2026-09-17T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/v1/documents successfully registers a compliance document', async () => {
    vi.spyOn(ComplianceDocumentRepository.prototype, 'create').mockResolvedValue(mockRecord as any);

    const response = await request(app)
      .post('/api/v1/documents')
      .send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: mockRecord,
    });
  });

  it('POST /api/v1/documents returns 400 when Zod schema validation fails', async () => {
    const response = await request(app)
      .post('/api/v1/documents')
      .send({
        document_type: '', // Invalid: empty string
        s3_uri: 'invalid-uri-scheme', // Invalid: missing s3://
      });

    expect(response.status).toBe(400);
  });

  it('GET /api/v1/documents returns a list of documents', async () => {
    vi.spyOn(ComplianceDocumentRepository.prototype, 'findAll').mockResolvedValue([mockRecord] as any);

    const response = await request(app).get('/api/v1/documents');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([mockRecord]);
  });

  it('GET /api/v1/documents/:id returns a single document when found', async () => {
    vi.spyOn(ComplianceDocumentRepository.prototype, 'findById').mockResolvedValue(mockRecord as any);

    const response = await request(app).get('/api/v1/documents/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockRecord);
  });

  it('GET /api/v1/documents/:id returns 404 when document is not found', async () => {
    vi.spyOn(ComplianceDocumentRepository.prototype, 'findById').mockResolvedValue(null);

    const response = await request(app).get('/api/v1/documents/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe('NOT_FOUND');
  });
});