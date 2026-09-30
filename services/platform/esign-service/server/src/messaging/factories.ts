// File: services/platform/esignature-service/server/src/messaging/factories.ts
import { DocumentSignedEvent, ESIGN_EVENT_TYPES, DocumentSignedData } from '@contracts/esign';

export interface DocumentSignedEventOptions {
  correlationId?: string;
  signedAt?: string;
  s3Uri?: string;
  storageBucket?: string;
  storageKey?: string;
  fileHash?: string;
}

/**
 * Test fixture factory producing deterministic CloudEvent v1.0 payloads 
 * for provider contract verification tests and unit testing.
 */
export function createDocumentSignedEvent(
  documentId: string,
  signerId: string,
  entityId: string,
  documentType: string = 'DD-1149',
  options: DocumentSignedEventOptions = {}
): DocumentSignedEvent {
  const data: DocumentSignedData = {
    documentId,
    documentType,
    signerId,
    entityId,
    status: 'SIGNED',
    signedAt: options.signedAt ?? '2026-09-27T12:00:00.000Z',
    ...(options.s3Uri && { s3Uri: options.s3Uri }),
    ...(options.storageBucket && { storageBucket: options.storageBucket }),
    ...(options.storageKey && { storageKey: options.storageKey }),
    ...(options.fileHash && { fileHash: options.fileHash }),
  };

  return {
    specversion: '1.0',
    id: 'evt_test_1001',
    source: 'service:esign-server',
    type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
    time: '2026-09-27T12:00:00.000Z',
    datacontenttype: 'application/json',
    correlationId: options.correlationId ?? 'cid_test_88192',
    data,
  };
}