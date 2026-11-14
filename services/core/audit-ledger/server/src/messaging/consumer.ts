// File: services/core/audit-ledger/server/src/messaging/consumer.ts
import type { z } from 'zod';
import { EventBroker } from '@shared/messaging';
import { COMPLIANCE_EVENT_SUBJECTS } from '@contracts/compliance';
import { TOPOLOGY_EVENT_SUBJECTS } from '@contracts/topology';
import { TOPOLOGY_DURABLE_CONSUMERS, COMPLIANCE_DURABLE_CONSUMERS } from './durableConsumers';
import { DEAD_LETTER_REASON } from 'audit-shared';
import { createLogger } from '@shared/express';
import {
  LedgerService,
  handleTransferCreatedSchema,
  handleTransferUpdatedSchema,
  handleTransferCompletedSchema,
  handleTransferInitiatedSchema,
  handleTransferReceivedSchema,
} from '../services';

const logger = createLogger('Audit:consumer');

/** Redelivery delay when the ledger itself fails (e.g. MongoDB down); redelivery is never capped, so no audit data is dropped. */
const RETRY_DELAY_MS = 5000;

export class AuditEventConsumer {
  constructor(
    private readonly broker: EventBroker,
    private readonly ledgerService: LedgerService
  ) {}

  public async start(signal?: AbortSignal): Promise<void> {
    await this.broker.waitForStream(TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME, [TOPOLOGY_EVENT_SUBJECTS.WILDCARD_ALL], signal);
    await this.broker.waitForStream(COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME, [COMPLIANCE_EVENT_SUBJECTS.WILDCARD_ALL], signal);

    await this.listen(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_CREATED,
      TOPOLOGY_DURABLE_CONSUMERS.AUDIT_CREATED,
      handleTransferCreatedSchema,
      (input) => this.ledgerService.handleTransferCreated(input)
    );
    await this.listen(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_UPDATED,
      TOPOLOGY_DURABLE_CONSUMERS.AUDIT_UPDATED,
      handleTransferUpdatedSchema,
      (input) => this.ledgerService.handleTransferUpdated(input)
    );
    await this.listen(
      TOPOLOGY_EVENT_SUBJECTS.STREAM_NAME,
      TOPOLOGY_EVENT_SUBJECTS.TRANSFER_EVENT_COMPLETED,
      TOPOLOGY_DURABLE_CONSUMERS.AUDIT_COMPLETED,
      handleTransferCompletedSchema,
      (input) => this.ledgerService.handleTransferCompleted(input)
    );
    await this.listen(
      COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME,
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED,
      COMPLIANCE_DURABLE_CONSUMERS.AUDIT_INITIATED,
      handleTransferInitiatedSchema,
      (input) => this.ledgerService.handleTransferInitiated(input)
    );
    await this.listen(
      COMPLIANCE_EVENT_SUBJECTS.STREAM_NAME,
      COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED,
      COMPLIANCE_DURABLE_CONSUMERS.AUDIT_RECEIVED,
      handleTransferReceivedSchema,
      (input) => this.ledgerService.handleTransferReceived(input)
    );
  }

  /**
   * Malformed events can never succeed on retry, so they are dead-lettered and acked.
   * Anything the service throws propagates, and the broker naks for a delayed redelivery.
   */
  private async listen<S extends z.ZodTypeAny>(
    stream: string,
    subject: string,
    durable: string,
    schema: S,
    handle: (input: z.output<S>) => Promise<void>
  ): Promise<void> {
    await this.broker.subscribe(
      stream,
      durable,
      async (payload: unknown, ack) => {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          const raw = payload as { id?: unknown; data?: { requisitionNumber?: unknown } } | null;
          await this.ledgerService.quarantine(
            DEAD_LETTER_REASON.MALFORMED,
            subject,
            payload,
            JSON.stringify(parsed.error.issues),
            {
              eventId: typeof raw?.id === 'string' ? raw.id : undefined,
              requisitionNumber:
                typeof raw?.data?.requisitionNumber === 'string' ? raw.data.requisitionNumber : undefined,
            }
          );
          ack();
          return;
        }

        logger.info(`Received ${subject} (${parsed.data.meta.eventId})`);
        await handle(parsed.data);
        ack();
      },
      subject,
      { nakDelayMs: RETRY_DELAY_MS }
    );
  }
}
