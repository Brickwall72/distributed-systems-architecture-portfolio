// File: services/core/compliance-service/server/src/messaging/consumer.ts
import { EventBroker } from '@shared/messaging';
import { ESIGN_SUBJECTS } from '@contracts/esign';
import { handleDocumentSignedEvent } from './handlers.js';

export class ESignEventConsumer {
  constructor(private readonly broker: EventBroker) {}

  public async start(): Promise<void> {
    // 1. Ensure JetStream stream exists prior to subscribing
    await this.broker.ensureStream(ESIGN_SUBJECTS.STREAM_NAME, [
      ESIGN_SUBJECTS.WILDCARD_ALL,
    ]);

    // 2. Subscribe using exact signature: (subject, durableName, handler)
    await this.broker.subscribe(
      ESIGN_SUBJECTS.DOCUMENT_SIGNED,
      'compliance-server-document-signed-consumer',
      async (payload: any, ack: () => void) => {
        try {
          await handleDocumentSignedEvent(payload);
          // Acknowledge receipt to JetStream after domain handler completes successfully
          ack();
        } catch (error) {
          this.broker.logger.error(`Error handling document signed event: ${error}`);
          // If Zod validation fails inside handleDocumentSignedEvent, swallow/log here so bad messages don't break the runner loop.
        }
      }
    );
  }
}