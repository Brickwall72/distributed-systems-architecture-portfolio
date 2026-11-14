// File: services/core/topology-service/server/src/messaging/signed-transfer.consumer.ts
import { createLogger } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import { COMPLIANCE_EVENT_SUBJECTS } from '@contracts/compliance';
import { COMPLIANCE_DURABLE_CONSUMERS } from './durableConsumers';
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, TOPOLOGY_SIGNED_EVENT_TYPE, signedTransferEventSchema } from '@contracts/topology';
import type { TransferClaimsRepository } from '../repositories/transfers';

const logger = createLogger('topology:signed-transfer-consumer');

export async function startSignedTransferConsumer(
  broker: Pick<EventBroker, 'waitForStream' | 'subscribe'>,
  claims: Pick<TransferClaimsRepository, 'commitSigned'>,
  signal?: AbortSignal,
): Promise<void> {
  await broker.waitForStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL], signal);
  await broker.subscribe(
    COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME,
    COMPLIANCE_DURABLE_CONSUMERS.TOPOLOGY_SIGNED,
    async (raw: unknown, ack: () => void) => {
      const event = signedTransferEventSchema.parse(raw);
      if (event.type !== TOPOLOGY_SIGNED_EVENT_TYPE || event.source !== 'service:compliance-server'
        || event.id !== `evt_compliance_signed_${event.data.documentId}`) {
        throw new Error('Signed transfer event identity is invalid');
      }
      await claims.commitSigned(event);
      logger.info(`Applied signed transfer ${event.data.documentId}`, event.correlationId);
      ack();
    },
    TOPOLOGY_SIGNED_EVENT_SUBJECT,
    { nakDelayMs: 5000 },
  );
}
