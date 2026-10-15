// File: packages/contracts/pdf/src/messaging/request-response.ts
import { z } from 'zod';

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

export const GeneratePdfResponseSchema = z.object({
  success: z.boolean(),
  documentId: z.string().uuid(),
  s3Uri: z.string().min(1),
  storageBucket: z.string().min(1),
  storageKey: z.string().min(1),
  presignedUrl: z.string().url(), // ✅ Added pre-signed download URL
  fileHash: z.string().optional(),
  correlationId: z.string().nullable().optional(),
});

export type GeneratePdfResponse = z.infer<typeof GeneratePdfResponseSchema>;