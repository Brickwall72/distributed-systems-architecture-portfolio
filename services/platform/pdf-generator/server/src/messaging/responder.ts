// File: services/platform/pdf-generator/server/src/messaging/responder.ts
import { EventBroker } from '@shared/messaging';
import { createLogger, runOperation } from '@shared/express';
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
  const register = (subject: string, allowedPath: RegExp) => broker.respond(subject, (rawPayload: GeneratePdfCommand) =>
    runOperation(logger, 'pdf.generate', async () => {
      const request = generatePdfCommandSchema.parse(rawPayload);
      const { html, documentId } = request;
      if (!/^[A-Za-z0-9_-]+$/.test(documentId) || !request.customPath || !allowedPath.test(request.customPath)) {
        throw new Error('PDF generation request is outside the permitted storage prefix');
      }

      const pdfBuffer = await runOperation(logger, 'pdf.render', () => generatePdfFromHtml(html));
      const generatedMetadata = getStorageMetadata(getStorageMetadataParamsSchema.parse(request));
      const storageMetadata = {
        ...(await runOperation(logger, 'pdf.upload', () => uploadGeneratedDocument(uploadGeneratedDocumentRequestSchema.parse({
          pdfBuffer,
          ...generatedMetadata,
        })))),
        ...generatedMetadata,
      };

      const presignedUrl = await runOperation(logger, 'pdf.download-url', () => publicStorageClient.getSignedDownloadUrl(
        getSignedDownloadUrlRequestSchema.parse(storageMetadata)
      ));

      return generatePdfResponseSchema.parse({
        ...storageMetadata,
        success: true,
        presignedUrl,
      });
    }));
  register(PDF_SUBJECTS.GENERATE_PDF, /^compliance\/drafts$/);
  register(PDF_SUBJECTS.GENERATE_AUDIT_PDF, /^audit\/transfers\/[1-9]\d*\/overview-v\d+$/);
}