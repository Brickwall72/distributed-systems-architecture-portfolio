// File: packages/file-storage/src/types.ts
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { S3ReferenceSchema } from '@contracts/common';

export { S3ReferenceSchema, type S3Reference } from '@contracts/common';

export const getFileStreamRequestSchema = S3ReferenceSchema.omit({ fileHash: true });

export type GetFileStreamRequest = z.infer<typeof getFileStreamRequestSchema>;

export const getStorageMetadataReturnSchema = getFileStreamRequestSchema.extend({
  metadata: z.record(z.string(), z.string())
});

export const uploadFileRequestSchema = getStorageMetadataReturnSchema.extend({
  pdfBuffer: z.instanceof(Buffer),
  contentType: z.string(),
})

export type UploadFileRequest = z.infer<typeof uploadFileRequestSchema>;

export const uploadFileResultSchema = z.object({
  fileHash: z.string(),
  uploadedAt: z.string(),
})

export type UploadFileResult = z.infer<typeof uploadFileResultSchema>;

export const getSignedDownloadUrlRequestSchema = getFileStreamRequestSchema.extend({
  expiresInSeconds: z.number().default(600),
})

export type GetSignedDownloadUrlRequest = z.infer<typeof getSignedDownloadUrlRequestSchema>;

export interface DocumentReader {
  getFileStream({storageBucket, storageKey}: GetFileStreamRequest): Promise<GetFileStreamResult>;
  getSignedDownloadUrl({storageBucket, storageKey, expiresInSeconds}: GetSignedDownloadUrlRequest): Promise<string>;
}

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface GetFileStreamResult {
  stream: Readable;
  contentType?: string;
}

export interface DocumentReader {
  getFileStream({storageBucket, storageKey}: GetFileStreamRequest): Promise<GetFileStreamResult>;
}

export interface DocumentWriter {
  uploadFile(request: UploadFileRequest): Promise<UploadFileResult>;
}

export interface StorageProvider extends DocumentReader, DocumentWriter {}