// File: services/core/compliance-service/server/src/messaging/consumer.ts
import { EventBroker } from '@shared/messaging';
import { ESIGN_SUBJECTS } from '@contracts/esign';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';
import { handleDocumentSignedEvent } from './handlers.js';

export class ESignEventConsumer {
  constructor(
    private readonly broker: EventBroker,
    private readonly repository: ComplianceDocumentRepository
  ) {}

  public async start(): Promise<void> {
    // 1. Ensure JetStream stream exists prior to subscribing
    await this.broker.ensureStream(ESIGN_SUBJECTS.STREAM_NAME, [
      ESIGN_SUBJECTS.WILDCARD_ALL,
    ]);

    // 2. Subscribe with updated signature: (streamName, durableName, handler, filterSubject)
    await this.broker.subscribe(
      ESIGN_SUBJECTS.STREAM_NAME,                     // Stream identifier (e.g., 'ESIGN_EVENTS')
      'compliance-server-document-signed-consumer',   // Durable consumer name
      async (payload: any, ack: () => void) => {
        // Allow exceptions to propagate so EventBroker triggers msg.nak() immediately
        await handleDocumentSignedEvent(payload, this.repository);
        
        // Acknowledge receipt to JetStream after database write succeeds
        ack();
      },
      ESIGN_SUBJECTS.DOCUMENT_SIGNED                  // Subject filter
    );
  }
}