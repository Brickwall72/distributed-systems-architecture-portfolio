// File: packages/contracts/common/src/s3-reference.schema.ts
import { z } from 'zod';

/**
 * Pure infrastructural reference for a binary object stored in MinIO/S3.
 */
export const S3ReferenceSchema = z.object({
  storageBucket: z.string().min(1, 'Storage bucket is required'),
  storageKey: z.string().min(1, 'Storage key path is required'),
  fileHash: z.string().length(64, 'File hash must be a valid SHA-256 hex string').optional(),
});

export type S3Reference = z.infer<typeof S3ReferenceSchema>;

export const getStorageMetadataParamsSchema = z.object({
  customPath: z.string().optional(),
  documentId: z.string(),
  documentName: z.string(),
  documentType: z.string(),
  requisitionNumber: z.string(),
  signerId: z.string().optional(),
  jobId: z.string().optional(),
  signedAt: z.string().optional(),
});
