// File: packages/contracts/pdf/src/messaging/request-response.ts
import { BaseDocumentResponseSchema } from '@contracts/common';
import { z } from 'zod';

export const PDF_SUBJECTS = {
  GENERATE_PDF: 'pdf.command.generate-draft',
} as const;

export const generatePdfCommandSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  documentType: z.string(),
  requisitionNumber: z.string(),
  customPath: z.string().optional(),
  jobId: z.string().optional(),
  html: z.string().min(1, 'Raw HTML string payload is required'),
});

export type GeneratePdfCommand = z.infer<typeof generatePdfCommandSchema>;

export const generatePdfResponseSchema = BaseDocumentResponseSchema;

export type GeneratePdfResponse = z.infer<typeof generatePdfResponseSchema>;