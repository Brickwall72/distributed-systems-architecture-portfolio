// File: packages/contracts/compliance/src/messaging/events.schema.ts
import { z } from 'zod';
import { createCloudEventSchema, transferTypeEnum } from '@contracts/common';

export const COMPLIANCE_EVENT_TYPES = {
  TRANSFER_INITIATED: 'com.system.compliance.transfer.initiated',
  TRANSFER_RECEIVED: 'com.system.compliance.transfer.received',
} as const;

export const COMPLIANCE_EVENT_SUBJECTS = {
  TRANSFER_INITIATED: 'events.compliance.transfer.initiated',
  TRANSFER_RECEIVED: 'events.compliance.transfer.received',
  STREAM_NAME: 'COMPLIANCE_EVENTS',
  WILDCARD_ALL: 'events.compliance.>',
} as const;

/** Facts about a signed document. The storage location is deliberately excluded; documentId resolves it. */
export const signedDocumentDataSchema = z.object({
  documentId: z.string().uuid(),
  documentName: z.string(),
  documentType: z.string(),
  fileHash: z.string().length(64),
  signerId: z.string(),
  signedAt: z.string().datetime(),
});

export const transferReceivedDataSchema = signedDocumentDataSchema.extend({
  transferEventId: z.string().uuid(),
  assetIds: z.array(z.string()),
  requisitionNumber: z.string(),
});

export const transferInitiatedDataSchema = signedDocumentDataSchema.extend({
  assetIds: transferReceivedDataSchema.shape.assetIds,
  requisitionNumber: transferReceivedDataSchema.shape.requisitionNumber,
  date: z.string().datetime(),
  transferType: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});

export const transferInitiatedEventSchema = createCloudEventSchema(transferInitiatedDataSchema);
export type TransferInitiatedEvent = z.infer<typeof transferInitiatedEventSchema>;

export const TransferReceivedEventSchema = createCloudEventSchema(transferReceivedDataSchema);
export type TransferReceivedEvent = z.infer<typeof TransferReceivedEventSchema>;