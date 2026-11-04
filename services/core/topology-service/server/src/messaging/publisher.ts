// File: services/core/topology-service/server/src/messaging/publisher.ts
import crypto from 'node:crypto';
import { EventBroker } from '@shared/messaging';
import {
  TOPOLOGY_EVENT_SUBJECTS,
  TOPOLOGY_EVENT_TYPES,
  transferEventCreatedDataSchema, transferEventCreatedEventSchema,
  transferEventUpdatedDataSchema, transferEventUpdatedEventSchema,
  transferEventCompletedDataSchema, transferEventCompletedEventSchema,
  transferAssetSnapshotSchema,
} from '@contracts/topology';
import { createLogger } from '@shared/express';
import z from 'zod';
import { transferStatusEnum, TRANSFER_STATUS } from '@contracts/common';
import { transferEventSnapshotSchema } from '../repositories';
const logger = createLogger('topology:publisher');

export const publishTransferEventCreatedInputSchema = transferEventSnapshotSchema.omit({ status: true });
export const publishTransferEventCreatedDataSchema = publishTransferEventCreatedInputSchema.transform((
  { id, type, ...rest }) => ({
    ...rest,
    transferEventId: id,
    transferType: type,
  }
)).pipe(transferEventCreatedDataSchema);
type PublishTransferEventCreatedData = z.infer<typeof publishTransferEventCreatedDataSchema>

export const publishTransferEventUpdatedInputSchema = z.object({
  id: z.string().uuid(),
  requisitionNumber: z.string(),
  status: transferStatusEnum,
  documentId: z.string().uuid(),
  receivedAssets: z.array(transferAssetSnapshotSchema).min(1),
});

export const publishTransferEventUpdatedDataSchema = publishTransferEventUpdatedInputSchema.transform((
  { id, status, ...rest }) => ({
    ...rest,
    transferEventId: id,
    transferEventStatus: status,
  }
)).pipe(transferEventUpdatedDataSchema);
type PublishTransferEventUpdatedData = z.infer<typeof publishTransferEventUpdatedDataSchema>;

export const publishTransferEventCompletedInputSchema = publishTransferEventCreatedInputSchema.extend({
  documentId: publishTransferEventUpdatedInputSchema.shape.documentId.optional(),
  receivedAssets: z.array(transferAssetSnapshotSchema),
});
export const publishTransferEventCompletedDataSchema = publishTransferEventCompletedInputSchema.transform((
  { id, type, ...rest }) => ({
    ...rest,
    transferEventId: id,
    transferType: type,
    transferEventStatus: TRANSFER_STATUS.COMPLETED,
  }
)).pipe(transferEventCompletedDataSchema);
type PublishTransferEventCompletedData = z.infer<typeof publishTransferEventCompletedDataSchema>;

export class TopologyPublisher {
  constructor(private readonly broker: EventBroker) {}

  public async init(): Promise<void> {
    await this.broker.ensureStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [
      TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL,
    ]);
  }

  public async publishTransferEventCreated(data: PublishTransferEventCreatedData, correlationId?: string | null): Promise<void> {
    const cid = correlationId || `cid_${crypto.randomUUID()}`;
    const event = transferEventCreatedEventSchema.parse({
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:topology-server',
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_CREATED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId: cid,
      data,
    });
    logger.debug(`event: ${JSON.stringify(event)}`);
    await this.broker.publish(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED, event);
  }
  public async publishTransferEventUpdated(data: PublishTransferEventUpdatedData, correlationId?: string | null): Promise<void> {
    const cid = correlationId || `cid_${crypto.randomUUID()}`;
    const event = transferEventUpdatedEventSchema.parse({
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:topology-server',
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_UPDATED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId: cid,
      data,
    });
    logger.debug(`event: ${JSON.stringify(event)}`);
    await this.broker.publish(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED, event);
  }
   public async publishTransferEventCompleted(data: PublishTransferEventCompletedData, correlationId?: string | null): Promise<void> {
    const cid = correlationId || `cid_${crypto.randomUUID()}`;
    const event = transferEventCompletedEventSchema.parse({
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:topology-server',
      type: TOPOLOGY_EVENT_TYPES.TRANSFER_EVENT_COMPLETED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId: cid,
      data,
    });
    logger.debug(`event: ${JSON.stringify(event)}`);
    await this.broker.publish(TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED, event);
  }
}