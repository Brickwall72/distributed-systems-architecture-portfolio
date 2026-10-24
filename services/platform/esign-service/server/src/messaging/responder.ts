// File: services/platform/esign-service/server/src/messaging/synchronous/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger } from '@shared/express';
import { 
  ESIGN_COMMAND_SUBJECTS, 
  SignDocumentResponseSchema, 
  type SignDocumentCommand,
} from '@contracts/esign';
import { 
  signDocumentFromStorage, 
  signDocumentFromStorageParamsSchema,
  signDocumentFromStorageReturnSchema, 
  uploadSignedDocument,
  uploadSignedDocumentParamsSchema, 
  publicStorageClient 
} from '../services';
import { getSignedDownloadUrlRequestSchema, getStorageMetadata, getStorageMetadataParamsSchema, getStorageMetadataReturnSchema } from '@shared/filestore';
import { z } from 'zod';
import { omitSchemaKeys } from '@shared/zod';

export const signDocumentCommandSchema = z.object({
  ...signDocumentFromStorageParamsSchema.shape,
  ...omitSchemaKeys(getStorageMetadataParamsSchema, signDocumentFromStorageReturnSchema).shape,
  ...omitSchemaKeys(uploadSignedDocumentParamsSchema, signDocumentFromStorageReturnSchema.extend(getStorageMetadataReturnSchema.shape)).shape,
  ...omitSchemaKeys(getSignedDownloadUrlRequestSchema, getStorageMetadataReturnSchema).shape,
}).omit({client: true, expiresInSeconds: true})

const logger = createLogger('esign-server:messaging');

export function registerESignResponder(broker: EventBroker): void {
  broker.respond(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, async (rawRequest: SignDocumentCommand) => {
    const request = signDocumentCommandSchema.parse(rawRequest);
    const { documentId } = request;
    logger.info(`Received NATS sign-document request for document: [${documentId}]`);

    // 1. Retrieve source PDF from MinIO and perform cryptographic signing (Claim-Check pattern)
    const signedData = await signDocumentFromStorage(
      signDocumentFromStorageParamsSchema.parse(request)
    );

    const generatedMetadata = getStorageMetadata(getStorageMetadataParamsSchema.parse({
      ...request,
      ...signedData,
    }))

    const storageMetadata = {
      ...(await uploadSignedDocument(uploadSignedDocumentParamsSchema.parse({
        ...signedData,
        ...generatedMetadata,
      }))),
      ...generatedMetadata,
    };

    logger.info(`Successfully signed and uploaded document: [${documentId}]`);

    // 2. Generate browser-reachable pre-signed download URL using publicStorageClient
    const presignedUrl = await publicStorageClient.getSignedDownloadUrl(
      getSignedDownloadUrlRequestSchema.parse(storageMetadata)
    );

    // 3. Return contract-validated synchronous response
    const now = new Date().toISOString();

    return SignDocumentResponseSchema.parse({
      ...request,
      ...signedData,
      ...storageMetadata,
      presignedUrl,
      id: request.documentId,
      success: true,
      createdAt: now,
      updatedAt: now,
    });
  });
}