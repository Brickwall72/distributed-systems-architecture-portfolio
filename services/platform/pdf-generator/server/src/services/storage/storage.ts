// File: services/platform/pdf-generator/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  type StorageProvider,
  type UploadResult,
} from '@shared/filestore';
import { env } from '../../config';

// 1. Internal client for container-to-container communication (Docker network: minio:9000)
export const internalStorageClient: StorageProvider = new ObjectStorageClient({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  forcePathStyle: true,
});

// 2. Public client strictly for generating pre-signed URLs reachable by the browser (localhost:9000)
export const publicStorageClient: StorageProvider = new ObjectStorageClient({
  endpoint: env.S3_PUBLIC_ENDPOINT,
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
  client: StorageProvider = internalStorageClient // Defaults to internal network client
): Promise<UploadResult> => {
  const { pdfBuffer, entityId, documentId, customPath, correlationId } = options;

  const sanitizedPath = customPath ? customPath.replace(/^\/+|\/+$/g, '') : '';
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