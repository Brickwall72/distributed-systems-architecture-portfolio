// File: packages/file-storage/src/s3-storage-client/s3-storage-client.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import crypto from 'node:crypto';
import {
  StorageConfig,
  UploadFileRequest,
  UploadFileResult,
  GetFileStreamResult,
  StorageProvider,
  GetFileStreamRequest,
  GetSignedDownloadUrlRequest,
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
  async uploadFile(request: UploadFileRequest): Promise<UploadFileResult> {
    const fileHash = crypto.createHash('sha256').update(request.pdfBuffer).digest('hex');

    const command = new PutObjectCommand({
      Bucket: request.storageBucket,
      Key: request.storageKey,
      Body: request.pdfBuffer,
      ContentType: request.contentType,
      Metadata: {
        ...request.metadata,
        'sha256-checksum': fileHash,
      },
    });

    await this.client.send(command);

    return {
      fileHash,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Downloads a file from object storage as a Node.js Readable stream.
   */
  async getFileStream({storageBucket, storageKey}: GetFileStreamRequest): Promise<GetFileStreamResult> {
    const command = new GetObjectCommand({
      Bucket: storageBucket,
      Key: storageKey,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`File not found or empty: s3://${storageBucket}/${storageKey}`);
    }

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
    };
  }

  getSignedDownloadUrl(
    {storageBucket, storageKey, expiresInSeconds}: GetSignedDownloadUrlRequest
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: storageBucket,
      Key: storageKey,
    });

    // Generates a cryptographically signed URL valid for the specified duration (default: 10 mins)
    // Cast needed: duplicate @smithy/smithy-client versions yield incompatible Client types
    return getSignedUrl(this.client as unknown as Parameters<typeof getSignedUrl>[0], command as unknown as Parameters<typeof getSignedUrl>[1], {
      expiresIn: expiresInSeconds,
    });
  }
}