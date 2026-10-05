// File: services/platform/esignature-service/server/src/routes/sign.unit.test.ts
import express from 'express';
import request from 'supertest';
import { router } from './signature';
import { signDocument } from '../../services/signing';
import { uploadSignedDocument } from '../../services/storage';
import { getESignPublisher } from '../../messaging/publisher';

// Mocks for internal dependencies
vi.mock('@shared/telemetry', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  createHealthCheck: () => (_req: unknown, res: { json: (data: unknown) => void }) =>
    res.json({ status: 'ok' }),
}));

vi.mock('../../services/signing', () => ({
  signDocument: vi.fn(),
}));

vi.mock('../../services/storage', () => ({
  uploadSignedDocument: vi.fn(),
}));

vi.mock('../../messaging/publisher', () => ({
  getESignPublisher: vi.fn(),
}));

describe('E-Signature Route (POST /)', () => {
  let app: express.Application;

  const mockSignedPdfBuffer = Buffer.from('%PDF-1.7 Signed Document Content');
  const mockSignedAt = '2026-09-30T04:34:42.100Z';
  const mockUploadedAt = '2026-09-30T04:34:42.150Z';

  const mockPublishDocumentSigned = vi.fn().mockResolvedValue(undefined);

  const validRequestBody = {
    pdfBase64: 'JVBERi0xLj...',
    signatureImageBase64: 'iVBORw0KGgo...',
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    documentType: 'DD-1149',
    signerId: 'usr_99128',
    entityId: 'org_77102',
    customPath: 'custom/path/doc.pdf',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/', router);

    vi.mocked(signDocument).mockResolvedValue({
      pdfBuffer: mockSignedPdfBuffer,
      signedAt: mockSignedAt,
    });

    vi.mocked(uploadSignedDocument).mockResolvedValue({
      s3Uri: 's3://esign-vault/signed/123e4567.pdf',
      bucket: 'esign-vault',
      key: 'signed/123e4567.pdf',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedAt: mockUploadedAt,
    });

    vi.mocked(getESignPublisher).mockReturnValue({
      publishDocumentSigned: mockPublishDocumentSigned,
    } as unknown as ReturnType<typeof getESignPublisher>);
  });

  describe('POST /', () => {
    it('should successfully sign, store, publish event, and return PDF binary', async () => {
      const response = await request(app)
        .post('/')
        .set('x-correlation-id', 'cid_test_1001')
        .send(validRequestBody);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        'inline; filename="digitally-signed-document.pdf"'
      );
      expect(response.body).toEqual(mockSignedPdfBuffer);

      expect(signDocument).toHaveBeenCalledWith({
        pdfBase64: validRequestBody.pdfBase64,
        signatureImageBase64: validRequestBody.signatureImageBase64,
        correlationId: 'cid_test_1001',
      });

      expect(uploadSignedDocument).toHaveBeenCalledWith({
        pdfBuffer: mockSignedPdfBuffer,
        entityId: validRequestBody.entityId,
        documentId: validRequestBody.documentId,
        customPath: validRequestBody.customPath,
        correlationId: 'cid_test_1001',
      });

      expect(mockPublishDocumentSigned).toHaveBeenCalledWith({
        data: {
          documentId: validRequestBody.documentId,
          documentType: validRequestBody.documentType,
          signerId: validRequestBody.signerId,
          entityId: validRequestBody.entityId,
          status: 'SIGNED',
          s3Uri: 's3://esign-vault/signed/123e4567.pdf',
          storageBucket: 'esign-vault',
          storageKey: 'signed/123e4567.pdf',
          fileHash:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          signedAt: mockSignedAt,
          uploadedAt: mockUploadedAt,
        },
        correlationId: 'cid_test_1001',
      });
    });

    it('should bypass publishing if getESignPublisher returns null', async () => {
      vi.mocked(getESignPublisher).mockReturnValue(undefined);

      const response = await request(app).post('/').send(validRequestBody);

      expect(response.status).toBe(200);
      expect(mockPublishDocumentSigned).not.toHaveBeenCalled();
    });

    it('should reject requests missing pdfBase64 or signatureImageBase64 with 400', async () => {
      const invalidBody = { ...validRequestBody, pdfBase64: '' };

      const response = await request(app).post('/').send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing pdfBase64 or signatureImageBase64 payload.',
      });
      expect(signDocument).not.toHaveBeenCalled();
    });

    it('should reject requests missing documentId, signerId, or entityId metadata with 400', async () => {
      const invalidBody = { ...validRequestBody, documentId: '' };

      const response = await request(app).post('/').send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error:
          'Missing documentId, signerId, or entityId metadata required for event contract.',
      });
      expect(signDocument).not.toHaveBeenCalled();
    });

    it('should return 500 when cryptographic signing service throws an error', async () => {
      vi.mocked(signDocument).mockRejectedValueOnce(
        new Error('Invalid digital certificate signature')
      );

      const response = await request(app).post('/').send(validRequestBody);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'E-Signature processing failed: Invalid digital certificate signature',
      });
      expect(uploadSignedDocument).not.toHaveBeenCalled();
      expect(mockPublishDocumentSigned).not.toHaveBeenCalled();
    });

    it('should return 500 when MinIO storage service throws an error', async () => {
      vi.mocked(uploadSignedDocument).mockRejectedValueOnce(
        new Error('S3 Storage Bucket write permissions denied')
      );

      const response = await request(app).post('/').send(validRequestBody);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error:
          'E-Signature processing failed: S3 Storage Bucket write permissions denied',
      });
      expect(mockPublishDocumentSigned).not.toHaveBeenCalled();
    });
  });
});