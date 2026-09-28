// File: services/core/compliance/server/src/messaging/handlers.ts
import { DocumentSignedEventSchema, DocumentSignedEvent } from '@contracts/esign';

export async function handleDocumentSignedEvent(rawPayload: unknown): Promise<void> {
  // Ingress DevSecOps Gate: Reject malformed payloads before they reach domain services
  const event: DocumentSignedEvent = DocumentSignedEventSchema.parse(rawPayload);

  const { documentId, signerId, entityId, status } = event.data;
  const { correlationId, id: eventId } = event;

  console.log(
    `[Compliance Service] [CID: ${correlationId}] [EventID: ${eventId}] ` +
    `Processing ${status} document ${documentId} for signer ${signerId} (entity ${entityId})`
  );

  // TODO: Add domain service call (e.g., complianceRepository.createAuditLog(...))
  // await complianceService.recordSignedDocument({ eventId, documentId, signerId, entityId });
}