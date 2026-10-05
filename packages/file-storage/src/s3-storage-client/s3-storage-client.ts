// File: packages/file-storage/src/s3-storage-client/s3-storage-client.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import crypto from 'node:crypto';
import type {
  StorageConfig,
  UploadRequest,
  UploadResult,
  DownloadResult,
  StorageProvider,
} from '../types';

export class ObjectStorageClient implements StorageProvider {
  private readonly client: S3Client;

  constructor(config: StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? true, // True is required for MinIO
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Uploads a buffer to object storage and returns metadata and the SHA256 hash.
   */
  async uploadFile(request: UploadRequest): Promise<UploadResult> {
    const fileHash = crypto.createHash('sha256').update(request.fileBuffer).digest('hex');

    const command = new PutObjectCommand({
      Bucket: request.bucket,
      Key: request.key,
      Body: request.fileBuffer,
      ContentType: request.contentType,
      Metadata: {
        ...request.metadata,
        'sha256-checksum': fileHash,
      },
    });

    await this.client.send(command);

    return {
      s3Uri: `s3://${request.bucket}/${request.key}`,
      bucket: request.bucket,
      key: request.key,
      fileHash,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Downloads a file from object storage as a Node.js Readable stream.
   */
  async getFileStream(bucket: string, key: string): Promise<DownloadResult> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`File not found or empty: s3://${bucket}/${key}`);
    }

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
    };
  }
}