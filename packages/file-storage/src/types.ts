// File: packages/file-storage/src/types.ts
import type { Readable } from 'node:stream';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface UploadRequest {
  bucket: string;
  key: string;
  fileBuffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  s3Uri: string;
  bucket: string;
  key: string;
  fileHash: string;
  uploadedAt: string;
}

export interface DownloadResult {
  stream: Readable;
  contentType?: string;
}

export interface DocumentReader {
  getFileStream(bucket: string, key: string): Promise<DownloadResult>;
}

export interface DocumentWriter {
  uploadFile(request: UploadRequest): Promise<UploadResult>;
}

export interface StorageProvider extends DocumentReader, DocumentWriter {}