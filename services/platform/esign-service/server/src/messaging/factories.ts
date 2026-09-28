// File: services/core/esign/server/src/messaging/factories.ts
import { DocumentSignedEvent, ESIGN_EVENT_TYPES } from '@contracts/esign';

/**
 * Test fixture factory producing deterministic CloudEvent v1.0 payloads 
 * for provider contract verification tests and unit testing.
 */
export function createDocumentSignedEvent(
  documentId: string,
  signerId: string,
  entityId: string,
  correlationId?: string
): DocumentSignedEvent {
  return {
    specversion: '1.0',
    id: 'evt_test_1001',
    source: 'service:esign-server',
    type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
    time: '2026-09-27T12:00:00.000Z',
    datacontenttype: 'application/json',
    correlationId: correlationId ?? 'cid_test_88192',
    data: {
      documentId,
      signerId,
      entityId,
      status: 'SIGNED',
    },
  };
}