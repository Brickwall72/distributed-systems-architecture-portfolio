// File: packages/contracts/common/src/storage.dto.schema.ts
import { z } from 'zod';
import { S3ReferenceSchema } from './s3-reference.schema';

/**
 * Full database-backed storage artifact including lifecycle audit timestamps.
 */
export const StorageArtifactSchema = S3ReferenceSchema.extend({
  documentId: z.string().uuid('Artifact ID must be a valid UUID'),
  documentName: z.string().optional(),
  documentType: z.string().optional(),
  createdAt: z.string().datetime('createdAt must be a valid ISO datetime string'),
  updatedAt: z.string().datetime('updatedAt must be a valid ISO datetime string').optional(),
});

export type StorageArtifact = z.infer<typeof StorageArtifactSchema>;