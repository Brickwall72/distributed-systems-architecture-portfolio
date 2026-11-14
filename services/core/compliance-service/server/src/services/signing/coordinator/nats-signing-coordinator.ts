// File: services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.ts
import { createLogger } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import { ESIGN_COMMAND_SUBJECTS, SignDocumentResponseSchema } from '@contracts/esign';
import type { SignedOutboxRepository, SigningOperationsRepository } from '../../../repositories';
import { TopologyConflict, type TopologyNatsClient } from '../../../messaging/topology';

const logger = createLogger('compliance:nats-signing-coordinator');
const RETRY_DELAY_MS = 5000;

export class NatsSigningCoordinator {
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private current: Promise<void> | undefined;

  constructor(
    private readonly operations: Pick<SigningOperationsRepository, 'claimNext' | 'saveSigned' | 'defer'>,
    private readonly topology: Pick<TopologyNatsClient, 'reserve'>,
    private readonly broker: Pick<EventBroker, 'request'>,
    private readonly outbox: Pick<SignedOutboxRepository, 'finalize'>,
  ) {}

  async processNext(documentId?: string): Promise<boolean> {
    const operation = await this.operations.claimNext(documentId);
    if (!operation) return false;
    try {
      const { claim, command } = operation;
      if (!command?.signerId) throw new Error('Signing operation is missing its command or signer');
      const reservation = await this.topology.reserve(claim);
      if (operation.state === 'PENDING') {
        const signed = SignDocumentResponseSchema.parse(await this.broker.request(
          ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, command, { timeout: 10000, correlationId: `claim_${claim.documentId}` },
        ));
        if (!signed.success) throw new Error('Signature service did not sign the document');
        await this.operations.saveSigned(operation, signed);
      } else if (!operation.signedResult?.success) {
        throw new Error('Signing operation has no successful signed result');
      }
      await this.outbox.finalize(operation, reservation.transferEventId);
      return true;
    } catch (error: unknown) {
      await this.operations.defer(
        operation, error instanceof TopologyConflict ? 'TRANSFER_CONFLICT' : 'RETRY',
        error instanceof TopologyConflict,
      );
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
      this.current = this.processNext()
        .then((processed) => this.schedule(processed ? 0 : RETRY_DELAY_MS))
        .catch((error: unknown) => {
          logger.error(`Signing reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
          this.schedule(RETRY_DELAY_MS);
        });
    }, delay);
  }
}
