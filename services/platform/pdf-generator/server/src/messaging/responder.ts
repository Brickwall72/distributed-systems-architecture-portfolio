// File: services/platform/pdf-generator/server/src/messaging/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger } from '@shared/express';
import { 
  PDF_SUBJECTS, GeneratePdfCommand, generatePdfResponseSchema 
} from '@contracts/pdf';
import { 
  generatePdfFromHtml, uploadGeneratedDocument, 
  uploadGeneratedDocumentRequestSchema, publicStorageClient 
} from '../services';
import { 
  getSignedDownloadUrlRequestSchema, getStorageMetadata, 
  getStorageMetadataParamsSchema, getStorageMetadataReturnSchema 
} from '@shared/filestore';
import { omitSchemaKeys } from '@shared/zod';
import z from 'zod';

export const generatePdfCommandSchema = getStorageMetadataParamsSchema.omit({signedAt: true, signerId: true}).extend({
  ...omitSchemaKeys(uploadGeneratedDocumentRequestSchema.omit({client: true, pdfBuffer: true}), getStorageMetadataReturnSchema).shape,
  html: z.string(),
})

const logger = createLogger('pdf-server:messaging');

export function registerPdfResponder(broker: EventBroker): void {
  const register = (subject: string, allowedPath: RegExp) => broker.respond(subject, async (rawPayload: GeneratePdfCommand) => {
    const request = generatePdfCommandSchema.parse(rawPayload);
    const { html, documentId } = request;
    if (!/^[A-Za-z0-9_-]+$/.test(documentId) || !request.customPath || !allowedPath.test(request.customPath)) {
      throw new Error('PDF generation request is outside the permitted storage prefix');
    }

    logger.info(`Received NATS PDF generation request for document [${documentId}]`);

    // 1. Generate PDF binary buffer via Puppeteer
    const pdfBuffer = await generatePdfFromHtml(html);

    const generatedMetadata = getStorageMetadata(getStorageMetadataParamsSchema.parse(
      request
    ))

    // 2. Persist to MinIO
    const storageMetadata = {
      ...(await uploadGeneratedDocument(uploadGeneratedDocumentRequestSchema.parse({
        pdfBuffer,
        ...generatedMetadata,
      }))),
      ...generatedMetadata,
    };

    // 3. Generate a short-lived (10-minute) pre-signed download URL
    const presignedUrl = await publicStorageClient.getSignedDownloadUrl(
      getSignedDownloadUrlRequestSchema.parse(storageMetadata)
    );

    logger.info(`Successfully generated PDF for document [${documentId}]`);

    return generatePdfResponseSchema.parse({
      ...storageMetadata,
      success: true,
      presignedUrl,
    });
  });
  register(PDF_SUBJECTS.GENERATE_PDF, /^compliance\/drafts$/);
  register(PDF_SUBJECTS.GENERATE_AUDIT_PDF, /^audit\/transfers\/[1-9]\d*\/overview-v\d+$/);
}