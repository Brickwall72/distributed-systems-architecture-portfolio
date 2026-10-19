// File: services/platform/esignature-service/server/src/services/signing/signDocumentFromStorage.ts
import { createLogger } from '@shared/express';
import { downloadDocumentStream } from '../storage';
import { signDocument, SignDocumentResult } from './signing';

const logger = createLogger('esign-server:signing');

export interface SignDocumentFromStorageParams {
  storageBucket?: string;
  storageKey: string;
  signatureImageBase64: string;
  correlationId?: string | null;
}

export async function signDocumentFromStorage({
  storageBucket,
  storageKey,
  signatureImageBase64,
  correlationId = null,
}: SignDocumentFromStorageParams): Promise<SignDocumentResult> {
  logger.debug(`Retrieving source PDF from storage bucket [${storageBucket || 'default'}] with key [${storageKey}]`, correlationId);

  const downloadResult = await downloadDocumentStream({
    bucket: storageBucket,
    key: storageKey,
  });

  // Depending on whether DownloadResult returns a stream or a buffer directly:
  const stream = (downloadResult as any).stream || (downloadResult as any).body || downloadResult;
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const sourcePdfBuffer = Buffer.concat(chunks);
  const pdfBase64 = sourcePdfBuffer.toString('base64');

  return signDocument({
    pdfBase64,
    signatureImageBase64,
    correlationId,
  });
}