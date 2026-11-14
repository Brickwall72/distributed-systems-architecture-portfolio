// File: services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts
import { createLogger } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import { COMPLIANCE_EVENT_SUBJECTS, transferInitiatedEventSchema, TransferReceivedEventSchema } from '@contracts/compliance';
import { TOPOLOGY_SIGNED_EVENT_SUBJECT, signedTransferEventSchema } from '@contracts/topology';
import type { SignedOutboxRepository } from '../../../repositories';

const logger = createLogger('compliance:signed-outbox');
const RETRY_DELAY_MS = 5000;

export class SignedOutboxService {
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private current: Promise<void> | undefined;

  constructor(
    private readonly repository: Pick<SignedOutboxRepository, 'claimNext' | 'markPublished' | 'defer' | 'flagStalled'>,
    private readonly broker: Pick<EventBroker, 'publish'>,
  ) {}

  async publishNext(): Promise<boolean> {
    await this.repository.flagStalled();
    const item = await this.repository.claimNext();
    if (!item) return false;
    try {
      let payload;
      switch (item.subject) {
        case TOPOLOGY_SIGNED_EVENT_SUBJECT:
          payload = signedTransferEventSchema.parse(item.payload);
          break;
        case COMPLIANCE_EVENT_SUBJECTS.TRANSFER_INITIATED:
          payload = transferInitiatedEventSchema.parse(item.payload);
          break;
        case COMPLIANCE_EVENT_SUBJECTS.TRANSFER_RECEIVED:
          payload = TransferReceivedEventSchema.parse(item.payload);
          break;
        default:
          throw new Error(`Unknown signed outbox subject: ${item.subject}`);
      }
      await this.broker.publish(item.subject, payload);
      await this.repository.markPublished(item);
      return true;
    } catch (error: unknown) {
      await this.repository.defer(item, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.current;
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.current = this.publishNext()
        .then((published) => this.schedule(published ? 0 : RETRY_DELAY_MS))
        .catch((error: unknown) => {
          logger.error(`Signed outbox publication failed: ${error instanceof Error ? error.message : String(error)}`);
          this.schedule(RETRY_DELAY_MS);
        });
    }, delay);
  }
}
