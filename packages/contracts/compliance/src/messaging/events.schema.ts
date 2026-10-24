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

export const TransferReceivedDataSchema = z.object({
  requisitionNumber: z.string(),
  assetIds: z.array(z.string()),
})

export const TransferInitiatedDataSchema = TransferReceivedDataSchema.extend({
  date: z.string().datetime(),
  transferType: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});

export const TransferInitiatedEventSchema = createCloudEventSchema(TransferInitiatedDataSchema);
export type TransferInitiatedEvent = z.infer<typeof TransferInitiatedEventSchema>;

export const TransferReceivedEventSchema = createCloudEventSchema(TransferReceivedDataSchema);
export type TransferReceivedEvent = z.infer<typeof TransferReceivedEventSchema>;