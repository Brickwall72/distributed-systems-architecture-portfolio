// File: packages/contracts/common/src/document-request.base.schema.ts
import { z } from 'zod';
import { S3ReferenceSchema } from './s3-reference.schema';

export const BaseDocumentRequestSchema = z.object({
  documentId: z.string().uuid('documentId must be a valid UUID'),
  documentName: z.string().min(1, 'documentName is required'),
  documentType: z.string().min(1, 'documentType is required'),
  customPath: z.string().optional(),
});

export const BaseDocumentResponseSchema = S3ReferenceSchema.extend({
  success: z.boolean(),
  presignedUrl: z.string().url(),
});
