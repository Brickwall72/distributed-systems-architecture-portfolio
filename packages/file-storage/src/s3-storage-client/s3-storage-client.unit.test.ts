// File: packages/file-storage/src/s3-storage-client/s3-storage-client.unit.test.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { ObjectStorageClient } from './s3-storage-client';
import { zocker } from 'zocker';
import { uploadFileRequestSchema, uploadFileResultSchema, type StorageConfig } from '../types';

describe('ObjectStorageClient (AWS S3 / MinIO Adapter)', () => {
  const mockConfig: StorageConfig = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    forcePathStyle: true,
  };

  let storageClient: ObjectStorageClient;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    storageClient = new ObjectStorageClient(mockConfig);
    sendSpy = vi.spyOn(S3Client.prototype, 'send');
  });

  describe('uploadFile', () => {
    it('computes sha256 checksum and issues PutObjectCommand with metadata', async () => {
      const pdfBuffer = Buffer.from('unit test file contents');
      const expectedHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      sendSpy.mockResolvedValueOnce({} as never);

      const request = zocker(uploadFileRequestSchema)
        .supply(uploadFileRequestSchema.shape.pdfBuffer, pdfBuffer)
        .generate();
      const result = await storageClient.uploadFile(request);

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const command = sendSpy.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: request.storageBucket,
        Key: request.storageKey,
        Body: pdfBuffer,
        ContentType: request.contentType,
        Metadata: {
          ...request.metadata,
          'sha256-checksum': expectedHash,
        },
      });

      expect(uploadFileResultSchema.parse(result)).toEqual(result);
      expect(result.fileHash).toBe(expectedHash);
      expect(new Date(result.uploadedAt).getTime()).not.toBeNaN();
    });

    it('propagates underlying S3 SDK execution failures', async () => {
      sendSpy.mockRejectedValueOnce(new Error('S3 service unavailable'));

      await expect(
        storageClient.uploadFile({
          storageBucket: 'compliance-docs',
          storageKey: 'test.pdf',
          pdfBuffer: Buffer.from('test'),
          contentType: 'application/pdf',
          metadata: {}
        })
      ).rejects.toThrow('S3 service unavailable');
    });
  });

  describe('getFileStream', () => {
    it('issues GetObjectCommand and returns stream with content type', async () => {
      const mockStream = new Readable();
      sendSpy.mockResolvedValueOnce({
        Body: mockStream,
        ContentType: 'application/pdf',
      } as never);

      const result = await storageClient.getFileStream({
        storageBucket:'compliance-docs', 
        storageKey: 'tenant-1/doc-100.pdf'
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const command = sendSpy.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'compliance-docs',
        Key: 'tenant-1/doc-100.pdf',
      });

      expect(result.stream).toBe(mockStream);
      expect(result.contentType).toBe('application/pdf');
    });

    it('throws explicit error when S3 response Body is missing or empty', async () => {
      sendSpy.mockResolvedValueOnce({
        Body: undefined,
      } as never);

      await expect(
        storageClient.getFileStream({storageBucket: 'compliance-docs', storageKey: 'missing.pdf}'})
      ).rejects.toThrow('File not found or empty: s3://compliance-docs/missing.pdf');
    });
  });
});