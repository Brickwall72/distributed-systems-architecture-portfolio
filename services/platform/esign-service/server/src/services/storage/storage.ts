// File: services/platform/esignature-service/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  type StorageProvider,
  type UploadResult,
  type DownloadResult,
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

// 2. Public client strictly for generating pre-signed URLs reachable by the browser
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

export const uploadSignedDocument = (
  options: UploadDocumentOptions,
  client: StorageProvider = internalStorageClient // Defaults to internal network client
): Promise<UploadResult> => {
  const { pdfBuffer, entityId, documentId, customPath, correlationId } = options;
  const sanitizedPath = customPath ? customPath.replace(/^\/+|\/+$/g, '') : '';
  const objectKey = sanitizedPath
    ? `${entityId}/${sanitizedPath}/${documentId}.pdf`
    : `${entityId}/${documentId}.pdf`;

  const bucket = process.env.DOCUMENT_BUCKET || 'dsap';  

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

export interface DownloadDocumentOptions {
  bucket?: string;
  key: string;
}

export const downloadDocumentStream = (
  { bucket, key }: DownloadDocumentOptions,
  client: StorageProvider = internalStorageClient // Defaults to internal network client
): Promise<DownloadResult> => {
  const targetBucket = bucket || process.env.DOCUMENT_BUCKET || 'dsap';
  return client.getFileStream(targetBucket, key);
};