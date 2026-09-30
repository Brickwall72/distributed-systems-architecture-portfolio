// File: services/platform/esignature-service/server/src/services/storage.unit.test.ts
import crypto from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { uploadSignedDocument } from './storage.js';

// Hoisting guarantees mocks are initialized before module import executes S3Client constructor
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(function () {
      return {
        send: mockSend,
      };
    }),
    PutObjectCommand: vi.fn().mockImplementation(function (input) {
      return { input };
    }),
  };
});

describe('uploadSignedDocument', () => {
  const samplePdfBuffer = Buffer.from('%PDF-1.7 Sample Signed Content');
  const expectedHash = crypto
    .createHash('sha256')
    .update(samplePdfBuffer)
    .digest('hex');

  const defaultOptions = {
    pdfBuffer: samplePdfBuffer,
    entityId: 'org_88192',
    documentId: 'doc_123456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload document with default entityId pathing and calculate valid SHA-256 checksum', async () => {
    const result = await uploadSignedDocument(defaultOptions);

    expect(mockSend).toHaveBeenCalledTimes(1);

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'compliance-documents',
      Key: 'org_88192/doc_123456.pdf',
      Body: samplePdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        'entity-id': 'org_88192',
        'document-id': 'doc_123456',
        'sha256-checksum': expectedHash,
      },
    });

    expect(result).toEqual({
      s3Uri: 's3://compliance-documents/org_88192/doc_123456.pdf',
      bucket: 'compliance-documents',
      key: 'org_88192/doc_123456.pdf',
      fileHash: expectedHash,
      uploadedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it('should normalize leading and trailing slashes in customPath', async () => {
    const customPathOptions = {
      ...defaultOptions,
      customPath: '///classified/transfers/2026///',
    };

    const result = await uploadSignedDocument(customPathOptions);

    expect(result.key).toBe('classified/transfers/2026/doc_123456.pdf');
    expect(result.s3Uri).toBe('s3://compliance-documents/classified/transfers/2026/doc_123456.pdf');

    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.Key).toBe('classified/transfers/2026/doc_123456.pdf');
  });

  it('should inject correlationId into Object Metadata when provided', async () => {
    const correlationId = 'cid_trace_9901';
    await uploadSignedDocument({
      ...defaultOptions,
      correlationId,
    });

    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.Metadata).toEqual({
      'entity-id': 'org_88192',
      'document-id': 'doc_123456',
      'sha256-checksum': expectedHash,
      'correlation-id': correlationId,
    });
  });

  it('should propagate S3 SDK errors when object storage write fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('S3 AccessDenied: Bucket write permission missing'));

    await expect(uploadSignedDocument(defaultOptions)).rejects.toThrow(
      'S3 AccessDenied: Bucket write permission missing'
    );
  });
});