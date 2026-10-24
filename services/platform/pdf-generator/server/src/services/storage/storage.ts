// File: services/platform/pdf-generator/server/src/services/storage/storage.ts
import {
  ObjectStorageClient,
  StorageProvider,
  uploadFileRequestSchema,
  UploadFileResult
} from '@shared/filestore';
import { env } from '../../config';
import { z } from 'zod';

export const uploadGeneratedDocumentRequestSchema = uploadFileRequestSchema.omit({contentType: true}).extend({
  client: z.custom<StorageProvider>((val) => typeof val === 'object' && val !== null).default(() => internalStorageClient),
})
type UploadGeneratedDocumentRequest = z.infer<typeof uploadGeneratedDocumentRequestSchema>;

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

export const uploadGeneratedDocument = (
  params: UploadGeneratedDocumentRequest,
): Promise<UploadFileResult> => {

  return params.client.uploadFile(uploadFileRequestSchema.parse({
    ...params,
    contentType: 'application/pdf',
  }));
};