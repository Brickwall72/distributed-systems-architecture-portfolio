// File: services/core/compliance-service/server/src/messaging/publisher.ts
import crypto from 'node:crypto';
import { EventBroker } from '@shared/messaging';
import { transferTypeEnum } from '@contracts/common';
import {
  COMPLIANCE_EVENT_SUBJECTS,
  COMPLIANCE_EVENT_TYPES,
  transferInitiatedEventSchema,
  TransferReceivedEventSchema,
  transferInitiatedDataSchema,
  transferReceivedDataSchema,
} from '@contracts/compliance';
import { z } from 'zod';
import { createLogger } from '@shared/express';
const logger = createLogger('compliance:publisher');

export const publishTransferReceivedInputSchema = z.object({
  id: z.string().uuid(),
  requisitionNumber: z.string(),
  assetIds: z.array(z.string()),
  transferEventId: z.string().uuid(),
});

export const publishtransferReceivedDataSchema = publishTransferReceivedInputSchema.transform((
  { id, ...rest }) => ({
    ...rest,
    documentId: id,
  }
)).pipe(transferReceivedDataSchema);
type PublishtransferReceivedDataSchema = z.infer<typeof publishtransferReceivedDataSchema>;

export const publishTransferInitiatedInputSchema = publishTransferReceivedInputSchema.omit(
  {transferEventId: true, id: true}
).extend({
  createdAt: z.string().datetime(),
  transferType: transferTypeEnum,
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
});

export const publishtransferInitiatedDataSchema = publishTransferInitiatedInputSchema.transform((
  { createdAt, ...rest }) => ({
    ...rest,
    date: createdAt,
  }
)).pipe(transferInitiatedDataSchema);
type PublishTransferInitiatedData = z.infer<typeof publishtransferInitiatedDataSchema>;

export class CompliancePublisher {
  constructor(private readonly broker: EventBroker) {}

  public async init(): Promise<void> {
    await this.broker.ensureStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [
      COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL,
    ]);
  }

  public async publishTransferInitiated(data: PublishTransferInitiatedData, correlationId?: string | null): Promise<void> {
    const cid = correlationId || `cid_${crypto.randomUUID()}`;
    const event = transferInitiatedEventSchema.parse({
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:compliance-server',
      type: COMPLIANCE_EVENT_TYPES.TRANSFER_INITIATED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId: cid,
      data: transferInitiatedDataSchema.parse(data),
    });
    logger.debug(`event: ${JSON.stringify(event)}`);
    await this.broker.publish(COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED, event);
  }

  public async publishTransferReceived(data: PublishtransferReceivedDataSchema, correlationId?: string | null): Promise<void> {
    const cid = correlationId || `cid_${crypto.randomUUID()}`;
    const event = TransferReceivedEventSchema.parse({
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:compliance-server',
      type: COMPLIANCE_EVENT_TYPES.TRANSFER_RECEIVED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId: cid,
      data: transferReceivedDataSchema.parse(data),
    });
    await this.broker.publish(COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED, event);
  }
}