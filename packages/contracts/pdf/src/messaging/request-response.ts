// File: packages/contracts/pdf/src/messaging/request-response.ts
import { z } from 'zod';
import { StorageArtifactSchema } from '@contracts/common';

export const PDF_SUBJECTS = {
  GENERATE_DRAFT: 'pdf.command.generate-draft',
} as const;

export const GeneratePdfRequestSchema = z.object({
  html: z.string().min(1, 'Raw HTML string payload is required'),
  documentId: z.string().uuid('documentId must be a valid UUID'),
  documentType: z.string().min(1, 'documentType is required'),
  entityId: z.string().min(1, 'entityId is required'),
  customPath: z.string().optional(),
  correlationId: z.string().nullable().optional(),
});

export type GeneratePdfRequest = z.infer<typeof GeneratePdfRequestSchema>;

export const GeneratePdfResponseSchema = StorageArtifactSchema.extend({
  success: z.boolean(),
  s3Uri: z.string().min(1),
  presignedUrl: z.string().url(),
  correlationId: z.string().nullable().optional(),
}).transform((data) => ({
  ...data,
  // Automatically generate the standardized s3Uri if missing
  s3Uri: data.s3Uri || `s3://${data.storageBucket}/${data.storageKey}`,
}));

export type GeneratePdfResponse = z.infer<typeof GeneratePdfResponseSchema>;