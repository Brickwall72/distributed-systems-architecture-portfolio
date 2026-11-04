// File: packages/contracts/compliance/src/messaging/events.ts
import { z } from 'zod';
import { createCloudEventSchema, transferStatusEnum, transferTypeEnum, TRANSFER_STATUS } from '@contracts/common';
import { OrganizationDTOSchema, AssetItemSchema } from '../outputs';

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

/** Point-in-time organization state captured when the event is published. */
export const transferOrganizationSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: OrganizationDTOSchema.shape.type,
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});
export type TransferOrganizationSnapshot = z.infer<typeof transferOrganizationSnapshotSchema>;

/** Point-in-time asset state captured when the event is published. */
export const transferAssetSnapshotSchema = AssetItemSchema.omit({ requisitionNumber: true }).extend({
  name: z.string(),
  currentOwnerId: z.string(),
});
export type TransferAssetSnapshot = z.infer<typeof transferAssetSnapshotSchema>;

export const transferEventCreatedDataSchema = z.object({
  requisitionNumber: z.string(),
  transferEventId: z.string().uuid(),
  transferType: transferTypeEnum,
  date: z.string().datetime(),
  sender: transferOrganizationSnapshotSchema,
  receiver: transferOrganizationSnapshotSchema,
  assets: z.array(transferAssetSnapshotSchema).min(1),
});
export type TransferEventCreatedData = z.infer<typeof transferEventCreatedDataSchema>;

export const transferEventCreatedEventSchema = createCloudEventSchema(transferEventCreatedDataSchema);
export type TransferEventCreatedEvent = z.infer<typeof transferEventCreatedEventSchema>;

export const transferEventUpdatedDataSchema = z.object({
  transferEventId: transferEventCreatedDataSchema.shape.transferEventId,
  requisitionNumber: transferEventCreatedDataSchema.shape.requisitionNumber.optional(),
  transferEventStatus: transferStatusEnum,
  documentId: z.string().uuid(),
  receivedAssets: z.array(transferAssetSnapshotSchema).min(1),
});
export type TransferEventUpdatedData = z.infer<typeof transferEventUpdatedDataSchema>;

export const transferEventUpdatedEventSchema = createCloudEventSchema(transferEventUpdatedDataSchema);
export type TransferEventUpdatedEvent = z.infer<typeof transferEventUpdatedEventSchema>;

/**
 * Completion may be the only topology event for a transfer (e.g. C2 transfers resolve instantly),
 * so it accumulates everything created and updated carry. `documentId` is absent when no receipt exists.
 */
export const transferEventCompletedDataSchema = transferEventCreatedDataSchema.extend({
  ...transferEventUpdatedDataSchema.shape,
  requisitionNumber: transferEventCreatedDataSchema.shape.requisitionNumber,
  transferEventStatus: z.literal(TRANSFER_STATUS.COMPLETED),
  documentId: transferEventUpdatedDataSchema.shape.documentId.optional(),
  receivedAssets: z.array(transferAssetSnapshotSchema),
});
export type TransferEventCompletedData = z.infer<typeof transferEventCompletedDataSchema>;

export const transferEventCompletedEventSchema = createCloudEventSchema(transferEventCompletedDataSchema);
export type TransferEventCompletedEvent = z.infer<typeof transferEventCompletedEventSchema>;
