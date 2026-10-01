// File: packages/contracts/esign/src/requests.ts
import { z } from 'zod';

export const SignDocumentRequestSchema = z.object({
  pdfBase64: z.string().min(1, 'pdfBase64 is required'),
  signatureImageBase64: z.string().min(1, 'signatureImageBase64 is required'),
  documentId: z.uuid('documentId must be a valid UUID'),
  signerId: z.string().min(1, 'signerId is required'),
  entityId: z.string().min(1, 'entityId is required'),
  customPath: z.string().optional(),
  documentType: z.string().optional(),
});

export type SignDocumentRequest = z.infer<typeof SignDocumentRequestSchema>;