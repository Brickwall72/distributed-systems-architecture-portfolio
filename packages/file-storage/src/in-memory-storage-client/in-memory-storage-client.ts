// File: packages/file-storage/src/in-ememory-storage-client/in-ememory-storage-client.ts
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import type {
  UploadFileRequest,
  UploadFileResult,
  GetFileStreamResult,
  StorageProvider,
  GetFileStreamRequest,
  GetSignedDownloadUrlRequest,
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

  uploadFile(request: UploadFileRequest): Promise<UploadFileResult> {
    const fileHash = crypto.createHash('sha256').update(request.pdfBuffer).digest('hex');
    const storageKey = this.getObjectKey(request.storageBucket, request.storageKey);

    this.storage.set(storageKey, {
      buffer: request.pdfBuffer,
      contentType: request.contentType,
      metadata: request.metadata,
    });

    return Promise.resolve({
      fileHash,
      uploadedAt: new Date().toISOString(),
    });
  }

  getFileStream({storageBucket, storageKey}: GetFileStreamRequest): Promise<GetFileStreamResult> {
    const memoryStorageKey = this.getObjectKey(storageBucket, storageKey);
    const item = this.storage.get(memoryStorageKey);

    if (!item) {
      return Promise.reject(new Error(`File not found or empty: s3://${storageBucket}/${storageKey}`));
    }

    return Promise.resolve({
      stream: Readable.from(item.buffer),
      contentType: item.contentType,
    });
  }

  getSignedDownloadUrl({storageBucket, storageKey}: GetSignedDownloadUrlRequest): Promise<string> {
    return Promise.resolve(`http://localhost:9000/${storageBucket}/${storageKey}?mock-presigned=true`);
  }

  /**
   * Helper utility for assertions during automated tests.
   */
  clear(): void {
    this.storage.clear();
  }
}