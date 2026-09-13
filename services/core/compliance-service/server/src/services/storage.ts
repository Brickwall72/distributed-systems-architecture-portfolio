// File: services/core/compliance-service/server/src/services/storage.service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

declare const process: {
  env: Record<string, string | undefined>;
};

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true, // Critical for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
});

/**
 * Uploads a signed PDF buffer to MinIO and returns the storage URI.
 */
export const uploadComplianceDocument = async (
  correlationId: string, 
  pdfBuffer: Buffer,
  documentType: string = 'transfer-approval'
): Promise<string> => {
  const bucket = process.env.S3_BUCKET || 'compliance-documents';
  const objectKey = `${documentType}/${correlationId}.pdf`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  await s3Client.send(command);
  
  // Return the internal URI to save in Postgres
  return `s3://${bucket}/${objectKey}`;
};