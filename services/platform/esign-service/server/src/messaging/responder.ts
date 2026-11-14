// File: services/platform/esign-service/server/src/messaging/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger } from '@shared/express';
import { createHash } from 'node:crypto';
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
  publicStorageClient,
  downloadDocumentStream,
  downloadDocumentStreamParamsSchema,
} from '../services';
import { getSignedDownloadUrlRequestSchema, getStorageMetadata, getStorageMetadataParamsSchema, getStorageMetadataReturnSchema, ObjectAlreadyExistsError, ObjectNotFoundError } from '@shared/filestore';
import { z } from 'zod';
import { omitSchemaKeys } from '@shared/zod';

export const signDocumentCommandSchema = z.object({
  ...signDocumentFromStorageParamsSchema.shape,
  ...omitSchemaKeys(getStorageMetadataParamsSchema, signDocumentFromStorageReturnSchema).shape,
  ...omitSchemaKeys(uploadSignedDocumentParamsSchema, signDocumentFromStorageReturnSchema.extend(getStorageMetadataReturnSchema.shape)).shape,
  ...omitSchemaKeys(getSignedDownloadUrlRequestSchema, getStorageMetadataReturnSchema).shape,
}).omit({client: true, expiresInSeconds: true, ifNotExists: true}).extend({
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
});

const logger = createLogger('esign-server:messaging');

async function findSignedResult(
  storage: { storageBucket: string; storageKey: string },
  requestHash: string,
): Promise<{ fileHash: string; signedAt: string; uploadedAt: string } | null> {
  let object;
  try {
    object = await downloadDocumentStream(downloadDocumentStreamParamsSchema.parse(storage));
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) return null;
    throw error;
  }
  const metadata = object.metadata;
  if (metadata?.['request-sha256'] !== requestHash) {
    object.stream.destroy();
    throw new Error('Signed document already exists for a different request');
  }
  const stored = z.object({
    fileHash: z.string().regex(/^[0-9a-f]{64}$/),
    signedAt: z.string().datetime(),
    uploadedAt: z.string().datetime(),
  }).parse({
    fileHash: metadata['sha256-checksum'],
    signedAt: metadata['signed-at'],
    uploadedAt: metadata['uploaded-at'],
  });
  const hash = createHash('sha256');
  for await (const chunk of object.stream) hash.update(chunk);
  if (hash.digest('hex') !== stored.fileHash) throw new Error('Signed document checksum does not match');
  return stored;
}

export function registerESignResponder(broker: EventBroker): void {
  broker.respond(ESIGN_COMMAND_SUBJECTS.SIGN_DOCUMENT, async (rawRequest: SignDocumentCommand) => {
    const request = signDocumentCommandSchema.parse(rawRequest);
    const { documentId } = request;
    logger.info(`Received NATS sign-document request for document: [${documentId}]`);

    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const destination = getStorageMetadata(getStorageMetadataParamsSchema.parse(request));
    let signed = await findSignedResult(destination, requestHash);
    if (!signed) {
      const signedData = await signDocumentFromStorage(signDocumentFromStorageParamsSchema.parse(request));
      const uploadedAt = new Date().toISOString();
      const metadata = {
        ...destination.metadata,
        'signed-at': signedData.signedAt,
        'uploaded-at': uploadedAt,
        'request-sha256': requestHash,
      };
      try {
        const uploaded = await uploadSignedDocument(uploadSignedDocumentParamsSchema.parse({
          ...destination, ...signedData, metadata, ifNotExists: true,
        }));
        signed = { fileHash: uploaded.fileHash, signedAt: signedData.signedAt, uploadedAt };
      } catch (error: unknown) {
        if (!(error instanceof ObjectAlreadyExistsError)) throw error;
        signed = await findSignedResult(destination, requestHash);
        if (!signed) throw new Error('Signed document disappeared after a conflicting upload');
      }
    }

    logger.info(`Successfully signed and uploaded document: [${documentId}]`);

    // 2. Generate browser-reachable pre-signed download URL using publicStorageClient
    const presignedUrl = await publicStorageClient.getSignedDownloadUrl(
      getSignedDownloadUrlRequestSchema.parse(destination)
    );

    // 3. Return contract-validated synchronous response
    const now = new Date().toISOString();

    return SignDocumentResponseSchema.parse({
      ...request,
      ...destination,
      ...signed,
      presignedUrl,
      id: request.documentId,
      success: true,
      createdAt: now,
      updatedAt: now,
    });
  });
}