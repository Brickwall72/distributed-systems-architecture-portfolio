// File: services/platform/esignature-service/server/src/messaging/publisher.ts
import crypto from 'node:crypto';
import { EventBroker } from '@shared/messaging';
import {
  ESIGN_SUBJECTS,
  ESIGN_EVENT_TYPES,
  DocumentSignedEvent,
  DocumentSignedEventSchema,
  DocumentSignedData,
  DocumentRejectedEvent,
  DocumentRejectedEventSchema,
  DocumentRejectedData,
} from '@contracts/esign';

let publisherInstance: ESignPublisher | undefined;

export function setESignPublisher(publisher: ESignPublisher): void {
  publisherInstance = publisher;
}

export function getESignPublisher(): ESignPublisher | undefined {
  return publisherInstance;
}

export class ESignPublisher {
  constructor(private readonly broker: EventBroker) {}

  public async init(): Promise<void> {
    await this.broker.ensureStream(ESIGN_SUBJECTS.STREAM_NAME, [
      ESIGN_SUBJECTS.WILDCARD_ALL,
    ]);
  }

  public async publishDocumentSigned(params: {
    data: DocumentSignedData;
    correlationId?: string | null;
  }): Promise<void> {
    const correlationId = params.correlationId || `cid_${crypto.randomUUID()}`;

    const rawEvent: DocumentSignedEvent = {
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:esign-server',
      type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId,
      data: params.data,
    };

    // Strict schema gate against createCloudEventSchema
    const validatedEvent = DocumentSignedEventSchema.parse(rawEvent);

    await this.broker.publish(
      ESIGN_SUBJECTS.DOCUMENT_SIGNED,
      validatedEvent,
      correlationId
    );
  }

  public async publishDocumentRejected(params: {
    data: DocumentRejectedData;
    correlationId?: string | null;
  }): Promise<void> {
    const correlationId = params.correlationId || `cid_${crypto.randomUUID()}`;

    const rawEvent: DocumentRejectedEvent = {
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:esign-server',
      type: ESIGN_EVENT_TYPES.DOCUMENT_REJECTED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId,
      data: params.data,
    };

    // Strict schema gate against createCloudEventSchema
    const validatedEvent = DocumentRejectedEventSchema.parse(rawEvent);

    await this.broker.publish(
      ESIGN_SUBJECTS.DOCUMENT_REJECTED,
      validatedEvent,
      correlationId
    );
  }
}