// File: services/platform/pdf-generator/server/src/messaging/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger } from '@shared/express';
import { PDF_SUBJECTS, GeneratePdfRequestSchema, GeneratePdfResponseSchema } from '@contracts/pdf';
import { generatePdfFromHtml, uploadGeneratedDocument, publicStorageClient } from '../services'; // Ensure storageClient is exported

const logger = createLogger('pdf-server:messaging');

export function registerPdfResponder(broker: EventBroker): void {
  broker.respond(PDF_SUBJECTS.GENERATE_DRAFT, async (rawPayload) => {
    const request = GeneratePdfRequestSchema.parse(rawPayload);
    const { html, documentId, entityId, customPath, correlationId } = request;

    logger.info(`Received NATS PDF generation request for document [${documentId}]`, correlationId);

    // 1. Generate PDF binary buffer via Puppeteer
    const pdfBuffer = await generatePdfFromHtml(html, correlationId);

    // 2. Persist to MinIO
    const targetEntityId = entityId || 'system';
    const storageMetadata = await uploadGeneratedDocument({
      pdfBuffer,
      entityId: targetEntityId,
      documentId,
      customPath,
      correlationId,
    });

    // 3. Generate a short-lived (10-minute) pre-signed download URL
    const presignedUrl = await publicStorageClient.getSignedDownloadUrl(
      storageMetadata.bucket,
      storageMetadata.key,
      600
    );

    logger.info(`Successfully generated pre-signed URL for document [${documentId}]: ${presignedUrl}`, correlationId);

    // 4. Return contract response
    const responsePayload = {
      success: true,
      documentId,
      s3Uri: storageMetadata.s3Uri,
      storageBucket: storageMetadata.bucket,
      storageKey: storageMetadata.key,
      presignedUrl,
      fileHash: storageMetadata.fileHash,
      correlationId,
    };

    return GeneratePdfResponseSchema.parse(responsePayload);
  });
}