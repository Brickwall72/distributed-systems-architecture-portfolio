// File: packages/contracts/compliance/src/messaging/events.ts
import { z } from 'zod';
import { createCloudEventSchema, transferStatusEnum } from '@contracts/common';

export const TOPOLOGY_EVENT_TYPES = {
  TRANSFER_EVENT_CREATED: 'com.system.topology.transfer.created',
  TRANSFER_EVENT_UPDATED: 'com.system.topology.transfer.updated',
  TRANSFER_EVENT_COMPLETED: 'com.system.topology.transfer.completed',
} as const;

export const TOPOLOGY_EVENT_SUBJECTS = {
  TRANSFER_EVENT_CREATED: 'events.topology.transfer.created',
  TRANSFER_EVENT_UPDATED: 'events.topology.transfer.updated',
  TRANSFER_EVENT_COMPLETED: 'events.topology.transfer.completed',
  STREAM_NAME: 'TOPOLOGY_EVENTS',
  WILDCARD_ALL: 'events.topology.>',
} as const;

export const transferEventCreatedDataSchema = z.object({
  requisitionNumber: z.string(),
  transferEventId: z.string().uuid(),
});
export type TransferEventCreatedData = z.infer<typeof transferEventCreatedDataSchema>;

export const transferEventCreatedEventSchema = createCloudEventSchema(transferEventCreatedDataSchema);
export type TransferEventCreatedEvent = z.infer<typeof transferEventCreatedEventSchema>;

export const transferEventUpdatedDataSchema = transferEventCreatedDataSchema.extend({
  transferEventStatus: transferStatusEnum,
  documentId: z.string().uuid(),
  requisitionNumber: z.string().optional(),
});
export type TransferEventUpdatedData = z.infer<typeof transferEventUpdatedDataSchema>;

export const transferEventUpdatedEventSchema = createCloudEventSchema(transferEventUpdatedDataSchema);
export type TransferEventUpdatedEvent = z.infer<typeof transferEventUpdatedEventSchema>;

export const transferEventCompletedDataSchema = transferEventCreatedDataSchema;
export type TransferEventCompletedData = z.infer<typeof transferEventCompletedDataSchema>;

export const transferEventCompletedEventSchema = createCloudEventSchema(transferEventCompletedDataSchema);
export type TransferEventCompletedEvent = z.infer<typeof transferEventCompletedEventSchema>;