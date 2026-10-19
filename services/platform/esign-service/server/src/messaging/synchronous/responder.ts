// File: services/platform/esign-service/server/src/messaging/synchronous/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger } from '@shared/express';
import { 
  ESIGN_COMMAND_SUBJECTS, 
  SignDocumentCommandSchema, 
  SignDocumentResponseSchema, 
  SignDocumentResponse 
} from '@contracts/esign';
import { signDocumentFromStorage, uploadSignedDocument, publicStorageClient } from '../../services';
import { ESignPublisher } from '../asynchronous';

const logger = createLogger('esign-server:messaging');

export function registerESignResponder(broker: EventBroker, publisher: ESignPublisher): void {
  broker.respond(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, async (rawPayload) => {
    const request = SignDocumentCommandSchema.parse(rawPayload);
    const { 
      storageBucket, 
      storageKey, 
      // fileHash, 
      signatureImageBase64, 
      documentId, 
      documentType, 
      signerId, 
      entityId, 
      customPath, 
      correlationId 
    } = request;

    logger.info(`Received NATS sign-document request for document [${documentId}]`, correlationId);

    // 1. Retrieve source PDF from MinIO and perform cryptographic signing (Claim-Check pattern)
    const { pdfBuffer, signedAt } = await signDocumentFromStorage({
      storageBucket,
      storageKey,
      signatureImageBase64,
      correlationId,
    });

    // 2. Persist signed PDF back to MinIO storage
    const targetEntityId = entityId || 'system';
    const storageMetadata = await uploadSignedDocument({
      pdfBuffer,
      entityId: targetEntityId,
      documentId,
      customPath,
      correlationId,
    });

    // 3. Publish asynchronous domain event over NATS JetStream (Pub/Sub) for auditing / compliance sync
    await publisher.publishDocumentSigned({
      data: {
        documentId,
        documentType,
        signerId,
        entityId,
        status: 'SIGNED',
        s3Uri: storageMetadata.s3Uri,
        storageBucket: storageMetadata.bucket,
        storageKey: storageMetadata.key,
        fileHash: storageMetadata.fileHash,
        signedAt,
        uploadedAt: storageMetadata.uploadedAt,
      },
      correlationId,
    });

    logger.info(`Successfully signed and published document signed event for [${documentId}]`, correlationId);

    // Generate browser-reachable pre-signed download URL using publicStorageClient
    const presignedUrl = await publicStorageClient.getSignedDownloadUrl(
      storageMetadata.bucket,
      storageMetadata.key,
      600
    );

    // 4. Return contract-validated synchronous response
    const now = new Date().toISOString();
    const responsePayload: SignDocumentResponse = {
      success: true,
      id: documentId,
      createdAt: now,
      updatedAt: now,
      storageBucket: storageMetadata.bucket,
      storageKey: storageMetadata.key,
      s3Uri: storageMetadata.s3Uri,
      presignedUrl,
      fileHash: storageMetadata.fileHash,
      signedAt,
      uploadedAt: storageMetadata.uploadedAt,
      correlationId,
    };

    return SignDocumentResponseSchema.parse(responsePayload);
  });
}