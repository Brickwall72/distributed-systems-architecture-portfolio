// File: services/platform/esign-service/server/src/services/signing/signDocumentFromStorage.ts
import { createLogger } from '@shared/express';
import { downloadDocumentStream, downloadDocumentStreamParamsSchema } from '../storage';
import { signDocument, signDocumentReturnSchema, signDocumentParamsSchema } from './signing';
import { z } from 'zod';
import { createHash } from 'node:crypto';

export const signDocumentFromStorageParamsSchema = downloadDocumentStreamParamsSchema.extend({
  ...signDocumentParamsSchema.omit({ pdfBuffer: true }).shape,
  fileHash: z.string().length(64).optional(),
});

type SignDocumentFromStorageParams = z.infer<typeof signDocumentFromStorageParamsSchema>;

export const signDocumentFromStorageReturnSchema = signDocumentReturnSchema;

type SignDocumentFromStorageReturn = z.infer<typeof signDocumentFromStorageReturnSchema>;

const logger = createLogger('esign-server:signing');

export async function signDocumentFromStorage(params: SignDocumentFromStorageParams): Promise<SignDocumentFromStorageReturn> {
  logger.debug(`Retrieving source PDF from storage bucket [${params.storageBucket || 'default'}] with key [${params.storageKey}]`);

  const downloadResult = await downloadDocumentStream(
    downloadDocumentStreamParamsSchema.parse(params)
  );

  const stream = downloadResult.stream;
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const pdfBuffer = Buffer.concat(chunks);
  if (params.fileHash && createHash('sha256').update(pdfBuffer).digest('hex') !== params.fileHash) {
    throw new Error('Stored draft hash does not match the signing request');
  }

  return signDocument(
    signDocumentParamsSchema.parse({...params, pdfBuffer})
  );
}