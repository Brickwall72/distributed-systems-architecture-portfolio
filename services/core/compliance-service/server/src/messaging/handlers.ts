// File: services/core/compliance-service/server/src/messaging/handlers.ts
import {
  DocumentRejectedEventSchema,
  DocumentRejectedEvent,
  SignDocumentResponseSchema,
  SignDocumentResponse,
} from '@contracts/esign';
import { ComplianceDocumentRepository } from '../repositories';
import { createLogger } from '@shared/express';

const logger = createLogger('compliance-server:messaging');

/**
 * Handles synchronous sign document response indexing
 */
export async function handleDocumentSignedEvent(
  rawPayload: unknown,
  repository: ComplianceDocumentRepository
): Promise<void> {
  const payload: SignDocumentResponse = SignDocumentResponseSchema.parse(rawPayload);
  const {
    id,
    documentType,
    signerId,
    entityId,
    storageBucket,
    storageKey,
    fileHash,
    s3Uri,
  } = payload;

  const correlationId = payload.correlationId || 'N/A';

  // Fallback bucket/key parsing if only s3Uri is present
  let bucket = storageBucket;
  let objectKey = storageKey;

  if ((!bucket || !objectKey) && s3Uri) {
    const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(s3Uri);
    if (match) {
      bucket = match[1];
      objectKey = match[2];
    } else {
      bucket = 'compliance-vault';
      objectKey = s3Uri;
    }
  }

  await repository.upsert({
    id,
    documentType,
    bucket: bucket || 'compliance-vault',
    objectKey: objectKey || `${documentType}/${id}.pdf`,
    status: 'SIGNED',
    signerId,
    entityId,
    documentHash: fileHash,
  });

  logger.info(
    `[CID: ${correlationId}] Successfully indexed SIGNED document '${documentType}' (${id}) for signer ${signerId}.`
  );
}

/**
 * Handles com.system.esign.document.rejected events
 */
export async function handleDocumentRejectedEvent(
  rawPayload: unknown,
  repository: ComplianceDocumentRepository
): Promise<void> {
  const event: DocumentRejectedEvent = DocumentRejectedEventSchema.parse(rawPayload);
  const { documentId, documentType, signerId, entityId, reason } = event.data;
  const correlationId = event.correlationId || 'N/A';

  await repository.upsert({
    id: documentId,
    documentType,
    bucket: 'compliance-vault',
    objectKey: `${documentType}/${documentId}-rejected.pdf`,
    status: 'REJECTED',
    signerId,
    entityId,
  });

  logger.warn(
    `[CID: ${correlationId}] Recorded REJECTED status for document '${documentType}' (${documentId}) from signer ${signerId}. Reason: "${reason}"`
  );
}