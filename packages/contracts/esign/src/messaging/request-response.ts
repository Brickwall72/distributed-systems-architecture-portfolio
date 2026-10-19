// File: packages/contracts/esign/src/messaging/request-response.ts
import { z } from 'zod';
import { StorageArtifactSchema, S3ReferenceSchema } from '@contracts/common';

export const ESIGN_COMMAND_SUBJECTS = {
  SIGN_DOCUMENT: 'esign.command.sign-document',
} as const;

export const SignDocumentCommandSchema = S3ReferenceSchema.extend({
  signatureImageBase64: z.string().min(1, 'Signature image Base64 is required'),
  documentId: z.string().uuid('documentId must be a valid UUID'),
  documentType: z.string().min(1, 'documentType is required'),
  signerId: z.string().min(1, 'signerId is required'),
  entityId: z.string().min(1, 'entityId is required'),
  customPath: z.string().optional(),
  correlationId: z.string().nullable().optional(),
});

export type SignDocumentCommand = z.infer<typeof SignDocumentCommandSchema>;

export const SignDocumentResponseSchema = StorageArtifactSchema.extend({
  success: z.boolean(),
  documentType: z.string().min(1),
  signerId: z.string().min(1),
  entityId: z.string().min(1),
  status: z.literal('SIGNED'),
  s3Uri: z.string().min(1),
  presignedUrl: z.string().url(),
  signedAt: z.string().datetime(),
  uploadedAt: z.string().datetime(),
  correlationId: z.string().nullable().optional(),
});

export type SignDocumentResponse = z.infer<typeof SignDocumentResponseSchema>;