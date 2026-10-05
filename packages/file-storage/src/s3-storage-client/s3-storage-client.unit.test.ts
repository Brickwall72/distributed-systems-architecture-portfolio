// File: packages/file-storage/src/s3-storage-client/s3-storage-client.unit.test.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { ObjectStorageClient } from './s3-storage-client';
import type { StorageConfig } from '../types';

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
      const fileBuffer = Buffer.from('unit test file contents');
      const expectedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      sendSpy.mockResolvedValueOnce({} as never);

      const result = await storageClient.uploadFile({
        bucket: 'compliance-docs',
        key: 'tenant-1/doc-100.pdf',
        fileBuffer,
        contentType: 'application/pdf',
        metadata: {
          'entity-id': 'tenant-1',
        },
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const command = sendSpy.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'compliance-docs',
        Key: 'tenant-1/doc-100.pdf',
        Body: fileBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          'entity-id': 'tenant-1',
          'sha256-checksum': expectedHash,
        },
      });

      expect(result).toEqual({
        s3Uri: 's3://compliance-docs/tenant-1/doc-100.pdf',
        bucket: 'compliance-docs',
        key: 'tenant-1/doc-100.pdf',
        fileHash: expectedHash,
        uploadedAt: expect.any(String),
      });
      expect(new Date(result.uploadedAt).getTime()).not.toBeNaN();
    });

    it('propagates underlying S3 SDK execution failures', async () => {
      sendSpy.mockRejectedValueOnce(new Error('S3 service unavailable'));

      await expect(
        storageClient.uploadFile({
          bucket: 'compliance-docs',
          key: 'test.pdf',
          fileBuffer: Buffer.from('test'),
          contentType: 'application/pdf',
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

      const result = await storageClient.getFileStream('compliance-docs', 'tenant-1/doc-100.pdf');

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
        storageClient.getFileStream('compliance-docs', 'missing.pdf')
      ).rejects.toThrow('File not found or empty: s3://compliance-docs/missing.pdf');
    });
  });
});