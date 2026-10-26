// File: packages/contracts/compliance/src/messaging/events.ts
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

export const transferReceivedDataSchema = z.object({
  transferEventId: z.string().uuid(),
  assetIds: z.array(z.string()),
  documentId: z.string().uuid(),
  requisitionNumber: z.string(),
})

export const transferInitiatedDataSchema = transferReceivedDataSchema.omit({transferEventId: true, documentId: true}).extend({
  date: z.string().datetime(),
  transferType: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});

export const transferInitiatedEventSchema = createCloudEventSchema(transferInitiatedDataSchema);
export type TransferInitiatedEvent = z.infer<typeof transferInitiatedEventSchema>;

export const TransferReceivedEventSchema = createCloudEventSchema(transferReceivedDataSchema);
export type TransferReceivedEvent = z.infer<typeof TransferReceivedEventSchema>;