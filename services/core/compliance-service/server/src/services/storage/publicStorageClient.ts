// File: services/platform/compliance-service/server/src/services/storage/publicStorageClient.ts
import { 
  ObjectStorageClient, StorageProvider
} from '@shared/filestore';
import { env } from '../../config';

export { getSignedDownloadUrlRequestSchema } from '@shared/filestore';

// Public client strictly for generating pre-signed URLs reachable by the browser
export const publicStorageClient: StorageProvider = new ObjectStorageClient({
  endpoint: env.S3_PUBLIC_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  forcePathStyle: true,
});