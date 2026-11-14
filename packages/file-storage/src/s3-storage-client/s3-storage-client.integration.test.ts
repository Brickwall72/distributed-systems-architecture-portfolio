// File: packages/file-storage/src/s3-storage-client/s3-storage-client.integration.test.ts
import { randomUUID } from 'node:crypto';
import { S3Client, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ObjectStorageClient } from './s3-storage-client';
import { ObjectAlreadyExistsError, ObjectNotFoundError } from '../types';

const endpoint = process.env.MINIO_TEST_ENDPOINT;
const accessKeyId = process.env.MINIO_TEST_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_TEST_SECRET_KEY;

describe('S3 conditional object storage', () => {
  const bucket = `test-${randomUUID()}`;
  const key = 'signed.pdf';
  let admin: S3Client;
  let storage: ObjectStorageClient;

  beforeAll(async () => {
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('MINIO_TEST_ENDPOINT and test credentials must point to an isolated MinIO instance');
    }
    const config = { endpoint, region: 'us-east-1', credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true };
    admin = new S3Client(config);
    storage = new ObjectStorageClient({ endpoint, region: config.region, accessKeyId, secretAccessKey, forcePathStyle: true });
    await admin.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    await admin.send(new DeleteBucketCommand({ Bucket: bucket }));
    admin.destroy();
  });

  it('creates exactly one object, preserves metadata, and identifies missing objects', async () => {
    await expect(storage.getFileStream({ storageBucket: bucket, storageKey: key })).rejects.toBeInstanceOf(ObjectNotFoundError);
    const request = {
      storageBucket: bucket, storageKey: key, contentType: 'application/pdf',
      metadata: { 'request-sha256': 'fingerprint' }, ifNotExists: true,
    };
    const outcomes = await Promise.allSettled([
      storage.uploadFile({ ...request, pdfBuffer: Buffer.from('first') }),
      storage.uploadFile({ ...request, pdfBuffer: Buffer.from('second') }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = outcomes.find((result) => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toBeInstanceOf(ObjectAlreadyExistsError);
    const object = await storage.getFileStream({ storageBucket: bucket, storageKey: key });
    expect(object.metadata?.['request-sha256']).toBe('fingerprint');
    const chunks: Buffer[] = [];
    for await (const chunk of object.stream) chunks.push(Buffer.from(chunk));
    const value = Buffer.concat(chunks).toString();
    expect(['first', 'second']).toContain(value);
  });
});
