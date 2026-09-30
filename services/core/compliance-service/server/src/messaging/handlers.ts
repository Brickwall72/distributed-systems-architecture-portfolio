// File: services/core/compliance-service/server/src/messaging/handlers.ts
import {
  DocumentSignedEventSchema,
  DocumentSignedEvent,
  DocumentRejectedEventSchema,
  DocumentRejectedEvent,
} from '@contracts/esign';
import { CreateComplianceDocumentSchema } from '@contracts/compliance';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';
import { createLogger } from '@shared/telemetry';

const logger = createLogger('compliance-server:messaging');

/**
 * Handles com.system.esign.document.signed events
 */
export async function handleDocumentSignedEvent(
  rawPayload: unknown,
  repository: ComplianceDocumentRepository
): Promise<void> {
  // 1. Ingress Gate: Parse raw CloudEvent against @contracts/esign schema
  const event: DocumentSignedEvent = DocumentSignedEventSchema.parse(rawPayload);

  const {
    documentId,
    documentType,
    signerId,
    entityId,
    s3Uri,
    storageBucket,
    storageKey,
    fileHash,
  } = event.data;

  const correlationId = event.correlationId || 'N/A';

  // 2. Resolve S3 URI from Claim-Check storage references
  let resolvedS3Uri = s3Uri;
  if (!resolvedS3Uri && storageBucket && storageKey) {
    resolvedS3Uri = `s3://${storageBucket}/${storageKey.replace(/^\/+/, '')}`;
  }
  if (!resolvedS3Uri) {
    resolvedS3Uri = `s3://compliance-documents/${documentType}/${documentId}.pdf`;
  }

  // 3. Contract Gate: Validate against CreateComplianceDocumentSchema
  const createPayload = CreateComplianceDocumentSchema.parse({
    id: documentId,
    document_type: documentType,
    s3_uri: resolvedS3Uri,
    status: 'Approved',
  });

  // 4. Persist to PostgreSQL
  const record = await repository.create(createPayload);

  logger.info(
    `[CID: ${correlationId}] Successfully indexed '${record.document_type}' (${record.id}) for signer ${signerId} (Entity: ${entityId}, Checksum: ${fileHash || 'N/A'}).`
  );
}

/**
 * Handles com.system.esign.document.rejected events
 */
export async function handleDocumentRejectedEvent(
  rawPayload: unknown,
  repository: ComplianceDocumentRepository
): Promise<void> {
  // 1. Ingress Gate: Parse raw CloudEvent against @contracts/esign schema
  const event: DocumentRejectedEvent = DocumentRejectedEventSchema.parse(rawPayload);

  const { documentId, documentType, signerId, reason } = event.data;
  const correlationId = event.correlationId || 'N/A';

  // Fallback URI satisfying CreateComplianceDocumentSchema's s3:// requirement
  const fallbackS3Uri = `s3://compliance-documents/${documentType}/${documentId}.pdf`;

  // 2. Contract Gate: Validate against CreateComplianceDocumentSchema
  const createPayload = CreateComplianceDocumentSchema.parse({
    id: documentId,
    document_type: documentType,
    s3_uri: fallbackS3Uri,
    status: 'Rejected',
  });

  // 3. Persist to PostgreSQL
  const record = await repository.create(createPayload);

  logger.warn(
    `[CID: ${correlationId}] Recorded rejection status for '${record.document_type}' (${record.id}) from signer ${signerId}. Reason: "${reason}"`
  );
}