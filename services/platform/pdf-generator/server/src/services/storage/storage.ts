// File: services/platform/esignature-service/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  type StorageProvider,
  type UploadResult,
} from '@shared/filestore';
import { env } from '../../config';

export const storageClient: StorageProvider = new ObjectStorageClient({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  forcePathStyle: true,
});

export interface UploadDocumentOptions {
  pdfBuffer: Buffer;
  entityId: string;
  documentId: string;
  customPath?: string;
  correlationId?: string | null;
}

export const uploadGeneratedDocument = (
  options: UploadDocumentOptions,
  client: StorageProvider = storageClient
): Promise<UploadResult> => {
  const { pdfBuffer, entityId, documentId, customPath, correlationId } = options;

  // 1. Sanitize customPath (e.g. "/drafts/" -> "drafts")
  const sanitizedPath = customPath ? customPath.replace(/^\/+|\/+$/g, '') : '';

  // 2. Construct key maintaining entityId isolation:
  // - With customPath='drafts': "acme-corp/drafts/doc-123.pdf"
  // - Without customPath:       "acme-corp/doc-123.pdf"
  const objectKey = sanitizedPath
    ? `${entityId}/${sanitizedPath}/${documentId}.pdf`
    : `${entityId}/${documentId}.pdf`;

  const bucket = env.DOCUMENT_BUCKET;

  const metadata: Record<string, string> = {
    'entity-id': entityId,
    'document-id': documentId,
  };

  if (correlationId) {
    metadata['correlation-id'] = correlationId;
  }

  return client.uploadFile({
    bucket,
    key: objectKey,
    fileBuffer: pdfBuffer,
    contentType: 'application/pdf',
    metadata,
  });
};