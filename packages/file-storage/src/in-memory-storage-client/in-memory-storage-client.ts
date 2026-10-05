// File: packages/file-storage/src/in-ememory-storage-client/in-ememory-storage-client.ts
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import type {
  UploadRequest,
  UploadResult,
  DownloadResult,
  StorageProvider,
} from '../types';

interface StoredObject {
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export class InMemoryStorageClient implements StorageProvider {
  public readonly storage = new Map<string, StoredObject>();

  private getObjectKey(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  uploadFile(request: UploadRequest): Promise<UploadResult> {
    const fileHash = crypto.createHash('sha256').update(request.fileBuffer).digest('hex');
    const storageKey = this.getObjectKey(request.bucket, request.key);

    this.storage.set(storageKey, {
      buffer: request.fileBuffer,
      contentType: request.contentType,
      metadata: request.metadata,
    });

    return Promise.resolve({
      s3Uri: `s3://${request.bucket}/${request.key}`,
      bucket: request.bucket,
      key: request.key,
      fileHash,
      uploadedAt: new Date().toISOString(),
    });
  }

  getFileStream(bucket: string, key: string): Promise<DownloadResult> {
    const storageKey = this.getObjectKey(bucket, key);
    const item = this.storage.get(storageKey);

    if (!item) {
      return Promise.reject(new Error(`File not found or empty: s3://${bucket}/${key}`));
    }

    return Promise.resolve({
      stream: Readable.from(item.buffer),
      contentType: item.contentType,
    });
  }

  /**
   * Helper utility for assertions during automated tests.
   */
  clear(): void {
    this.storage.clear();
  }
}