// File: packages/contracts/esign/src/messaging/request-response.ts
import { BaseDocumentResponseSchema, S3ReferenceSchema, getStorageMetadataParamsSchema } from '@contracts/common';
import { z } from 'zod';

export const ESIGN_COMMAND_SUBJECTS = {
  SIGN_DOCUMENT: 'esign.command.sign-document',
} as const;

export const SignDocumentCommandSchema = S3ReferenceSchema.extend({
  ...getStorageMetadataParamsSchema.omit({signedAt: true}).shape,
  signatureImageBase64: z.string(),
});

export type SignDocumentCommand = z.infer<typeof SignDocumentCommandSchema>;

export const SignDocumentResponseSchema = BaseDocumentResponseSchema.extend({
  signedAt: z.string().datetime(),
  uploadedAt: z.string().datetime(),
});

export type SignDocumentResponse = z.infer<typeof SignDocumentResponseSchema>;