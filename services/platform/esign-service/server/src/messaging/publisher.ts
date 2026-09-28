// File: services/platform/esignature-service/server/src/messaging/publisher.ts
import { EventBroker } from '@shared/messaging';
import {
  ESIGN_SUBJECTS,
  ESIGN_EVENT_TYPES,
  DocumentSignedEvent,
  DocumentSignedEventSchema,
  DocumentSignedData,
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
    const correlationId = params.correlationId ?? `cid_${crypto.randomUUID()}`;

    const event: DocumentSignedEvent = {
      specversion: '1.0',
      id: `evt_${crypto.randomUUID()}`,
      source: 'service:esign-server',
      type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlationId,
      data: params.data,
    };

    const validatedEvent = DocumentSignedEventSchema.parse(event);

    await this.broker.publish(
      ESIGN_SUBJECTS.DOCUMENT_SIGNED,
      validatedEvent,
      correlationId
    );
  }
}