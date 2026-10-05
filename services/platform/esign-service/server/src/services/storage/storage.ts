// File: services/platform/esignature-service/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  type StorageProvider,
  type UploadResult,
  type DownloadResult,
} from '@shared/filestore';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;

if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
  throw new Error('FATAL: S3_ACCESS_KEY and S3_SECRET_KEY must be provided via environment variables.');
}

// Type the singleton against the interface contract
export const storageClient: StorageProvider = new ObjectStorageClient({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  accessKeyId: S3_ACCESS_KEY,
  secretAccessKey: S3_SECRET_KEY,
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
  client: StorageProvider = storageClient // Optional injection for testing
): Promise<UploadResult> => {
  const { pdfBuffer, entityId, documentId, customPath, correlationId } = options;
  const cleanPrefix = customPath ? customPath.replace(/^\/+/, '').replace(/\/+$/, '') : entityId;
  const bucket = process.env.DOCUMENT_BUCKET || 'compliance-documents'; 
  const objectKey = `${cleanPrefix}/${documentId}.pdf`;

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
  client: StorageProvider = storageClient // Optional injection for testing
): Promise<DownloadResult> => {
  const targetBucket = bucket || process.env.DOCUMENT_BUCKET || 'compliance-documents';
  return client.getFileStream(targetBucket, key);
};