// File: packages/contracts/common/src/storage.dto.schema.ts
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

/**
 * Full database-backed storage artifact including lifecycle audit timestamps.
 */
export const StorageArtifactSchema = S3ReferenceSchema.extend({
  id: z.string().uuid('Artifact ID must be a valid UUID'),
  createdAt: z.string().datetime('createdAt must be a valid ISO datetime string'),
  updatedAt: z.string().datetime('updatedAt must be a valid ISO datetime string').optional(),
});

export type StorageArtifact = z.infer<typeof StorageArtifactSchema>;