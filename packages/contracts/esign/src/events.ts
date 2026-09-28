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

export const DocumentSignedDataSchema = z.object({
  documentId: z.string().uuid(),
  signerId: z.string(),
  entityId: z.string(),
  status: z.literal('SIGNED'),
});
export type DocumentSignedData = z.infer<typeof DocumentSignedDataSchema>;

export const DocumentSignedEventSchema = createCloudEventSchema(DocumentSignedDataSchema);
export type DocumentSignedEvent = z.infer<typeof DocumentSignedEventSchema>;