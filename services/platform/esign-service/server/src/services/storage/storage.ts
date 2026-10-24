// File: services/platform/esignature-service/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  StorageProvider,
  UploadFileResult,
  GetFileStreamResult,
  getFileStreamRequestSchema,
  uploadFileRequestSchema,
} from '@shared/filestore';
import { env } from '../../config';
import { z } from 'zod';

export const downloadDocumentStreamParamsSchema = getFileStreamRequestSchema.extend({
  client: z.custom<StorageProvider>((val) => typeof val === 'object' && val !== null).default(() => internalStorageClient),
});

type DownloadDocumentStreamParams = z.infer<typeof downloadDocumentStreamParamsSchema>;

export const uploadSignedDocumentParamsSchema = uploadFileRequestSchema.omit({ contentType: true }).extend({
  client: z.custom<StorageProvider>((val) => typeof val === 'object' && val !== null).default(() => internalStorageClient),
});

type UploadSignedDocumentParams = z.infer<typeof uploadSignedDocumentParamsSchema>;

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

export const uploadSignedDocument = (
  params: UploadSignedDocumentParams,
): Promise<UploadFileResult> => {

  return params.client.uploadFile(uploadFileRequestSchema.parse({
    ...params,
    contentType: 'application/pdf',
  }));
};

export const downloadDocumentStream = (
  params: DownloadDocumentStreamParams,
): Promise<GetFileStreamResult> => {
  return params.client.getFileStream(getFileStreamRequestSchema.parse(params));
};