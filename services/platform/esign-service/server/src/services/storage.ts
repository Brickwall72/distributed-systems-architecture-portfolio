// File: services/platform/esignature-service/server/src/services/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true, // Required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
});

export interface UploadDocumentOptions {
  pdfBuffer: Buffer;
  entityId: string;
  documentId: string;
  bucket?: string;
  customPath?: string;
  correlationId?: string | null;
}

export interface UploadDocumentResult {
  s3Uri: string;
  bucket: string;
  key: string;
  fileHash: string;
  uploadedAt: string; // ISO 8601 UTC timestamp of S3 write completion
}

/**
 * Uploads a signed document buffer to S3/MinIO using domain-agnostic pathing.
 */
export const uploadSignedDocument = async ({
  pdfBuffer,
  entityId,
  documentId,
  customPath,
  correlationId,
}: UploadDocumentOptions): Promise<UploadDocumentResult> => {
  // Build a standard platform key (<entityId>/<documentId>.pdf) unless a custom path prefix is supplied
  const cleanPrefix = customPath ? customPath.replace(/^\/+|\/+$/g, '') : entityId;
  const bucket: string = 'compliance-documents'; // TODO: Derive bucket dynamically from payload context
  const objectKey = `${cleanPrefix}/${documentId}.pdf`;

  // SHA-256 for audit trails and payload integrity checks
  const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      'entity-id': entityId,
      'document-id': documentId,
      'sha256-checksum': fileHash,
      ...(correlationId ? { 'correlation-id': correlationId } : {}),
    },
  });

  await s3Client.send(command);
  const uploadedAt = new Date().toISOString(); // Record completion timestamp at storage write boundary

  return {
    s3Uri: `s3://${bucket}/${objectKey}`,
    bucket,
    key: objectKey,
    fileHash,
    uploadedAt,
  };
};