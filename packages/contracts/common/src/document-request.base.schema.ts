// File: packages/contracts/common/src/document-request.base.schema.ts
import { z } from 'zod';
import { S3ReferenceSchema } from './s3-reference.schema';

export const BaseDocumentResponseSchema = S3ReferenceSchema.extend({
  success: z.boolean(),
  presignedUrl: z.string().url(),
});
