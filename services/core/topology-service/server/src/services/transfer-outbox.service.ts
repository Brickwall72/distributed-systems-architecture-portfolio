// File: services/core/topology-service/server/src/services/transfer-outbox.service.ts
import { createLogger, runInNewDiagnosticContext, runOperation, safeErrorMetadata, withoutDiagnosticContext } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import type { TransferOutboxRepository } from '../repositories/transfers';

const logger = createLogger('topology:transfer-outbox');
const RETRY_DELAY_MS = 5000;

export class TransferOutboxService {
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private current: Promise<void> | undefined;

  constructor(
    private readonly repository: Pick<TransferOutboxRepository, 'claimNext' | 'markPublished'>,
    private readonly broker: Pick<EventBroker, 'publish'>,
  ) {}

  async publishNext(): Promise<boolean> {
    return runInNewDiagnosticContext(async () => {
      const item = await this.repository.claimNext();
      if (!item) return false;
      return runOperation(logger, 'topology.outbox.publish', async () => {
        await this.broker.publish(item.subject, item.event);
        await runOperation(logger, 'topology.outbox.mark-published', () => this.repository.markPublished(item));
        return true;
      }, { metadata: { subject: item.subject, documentId: item.documentId, eventId: item.event.id } });
    });
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
    this.timer = withoutDiagnosticContext(() => setTimeout(() => {
      this.timer = undefined;
      this.current = this.publishNext()
        .then((published) => this.schedule(published ? 0 : RETRY_DELAY_MS))
        .catch((error: unknown) => {
          logger.error('Transfer outbox publication failed; retry scheduled', undefined, safeErrorMetadata(error));
          this.schedule(RETRY_DELAY_MS);
        });
    }, delay));
  }
}
