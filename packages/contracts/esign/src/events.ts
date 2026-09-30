// File: packages/contracts/esign/src/events.ts
import { z } from 'zod';
import { createCloudEventSchema } from '@contracts/common';

export const ESIGN_EVENT_TYPES = {
  DOCUMENT_SIGNED: 'com.system.esign.document.signed',
  DOCUMENT_REJECTED: 'com.system.esign.document.rejected',
} as const;

export const ESIGN_SUBJECTS = {
  DOCUMENT_SIGNED: 'events.esign.compliance.document.signed',
  DOCUMENT_REJECTED: 'events.esign.compliance.document.rejected',
  STREAM_NAME: 'ESIGN_EVENTS',
  WILDCARD_ALL: 'events.esign.>',
} as const;

/**
 * Payload schema for com.system.esign.document.signed
 */
export const DocumentSignedDataSchema = z.object({
  documentId: z.uuid('documentId must be a valid UUID'),
  documentType: z.string().min(1, 'documentType is required'),
  signerId: z.string().min(1, 'signerId is required'),
  entityId: z.string().min(1, 'entityId is required'),
  status: z.literal('SIGNED'),

  // Domain & Infrastructure Timestamps (Strict ISO 8601 UTC)
  signedAt: z.iso.datetime({ message: 'signedAt must be a valid ISO 8601 timestamp' }),
  uploadedAt: z.iso.datetime({ message: 'uploadedAt must be a valid ISO 8601 timestamp' }).optional(),

  // Claim-check storage references
  s3Uri: z.string().optional(),
  storageBucket: z.string().optional(),
  storageKey: z.string().optional(),
  fileHash: z.string().optional(),
});

export type DocumentSignedData = z.infer<typeof DocumentSignedDataSchema>;

export const DocumentSignedEventSchema = createCloudEventSchema(DocumentSignedDataSchema);
export type DocumentSignedEvent = z.infer<typeof DocumentSignedEventSchema>;

/**
 * Payload schema for com.system.esign.document.rejected
 */
export const DocumentRejectedDataSchema = z.object({
  documentId: z.uuid('documentId must be a valid UUID'),
  documentType: z.string().min(1, 'documentType is required'),
  signerId: z.string().min(1, 'signerId is required'),
  entityId: z.string().min(1, 'entityId is required'),
  status: z.literal('REJECTED'),
  reason: z.string().min(1, 'Rejection reason is required'),

  // Domain Timestamp
  rejectedAt: z.iso.datetime({ message: 'rejectedAt must be a valid ISO 8601 timestamp' }),
});

export type DocumentRejectedData = z.infer<typeof DocumentRejectedDataSchema>;

export const DocumentRejectedEventSchema = createCloudEventSchema(DocumentRejectedDataSchema);
export type DocumentRejectedEvent = z.infer<typeof DocumentRejectedEventSchema>;