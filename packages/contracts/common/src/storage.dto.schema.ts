// File: packages/contracts/common/src/storage.dto.schema.ts
import { z } from 'zod';

/**
 * Canonical base schema for any binary file artifact stored in MinIO/S3 
 * and tracked across the distributed platform.
 */
export const StorageArtifactSchema = z.object({
  id: z.string().uuid('Artifact ID must be a valid UUID'),
  storageBucket: z.string().min(1, 'Storage bucket is required'),
  storageKey: z.string().min(1, 'Storage key path is required'),
  fileHash: z.string().length(64, 'File hash must be a valid SHA-256 hex string').optional(),
  createdAt: z.string().datetime('createdAt must be a valid ISO datetime string'),
  updatedAt: z.string().datetime('updatedAt must be a valid ISO datetime string').optional(),
});

export type StorageArtifact = z.infer<typeof StorageArtifactSchema>;