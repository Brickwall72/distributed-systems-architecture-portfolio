// File: packages/file-storage/src/s3-storage-client/s3-authorization.integration.test.ts
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ObjectStorageClient } from './s3-storage-client';
import { ObjectAlreadyExistsError, ObjectNotFoundError } from '../types';

const endpoint = process.env.MINIO_TEST_ENDPOINT;
const bucket = 'dsap';
const id = randomUUID();
const complianceKey = `compliance/drafts/${id}.pdf`;
const auditKey = `audit/transfers/1/overview-v1/${id}.pdf`;

function credentials(user: string) {
  if (!endpoint) throw new Error('MINIO_TEST_ENDPOINT must point to an isolated MinIO instance');
  return { endpoint, region: 'us-east-1', accessKeyId: `${user}-test`, secretAccessKey: `${user}-test-password`, forcePathStyle: true };
}

function s3(user: string) {
  const config = credentials(user);
  return new S3Client({
    endpoint: config.endpoint, region: config.region, forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

describe('scoped MinIO policies', () => {
  let admin: S3Client;
  beforeAll(async () => {
    if (!endpoint || !process.env.MINIO_TEST_ACCESS_KEY || !process.env.MINIO_TEST_SECRET_KEY) {
      throw new Error('MinIO integration credentials must point to an isolated instance');
    }
    admin = new S3Client({
      endpoint, region: 'us-east-1', forcePathStyle: true,
      credentials: { accessKeyId: process.env.MINIO_TEST_ACCESS_KEY, secretAccessKey: process.env.MINIO_TEST_SECRET_KEY },
    });
    for (const Key of [complianceKey, auditKey]) {
      await admin.send(new PutObjectCommand({ Bucket: bucket, Key, Body: 'fictional test document' }));
    }
  });

  afterAll(() => admin?.destroy());

  it.each([
    ['compliance', complianceKey, auditKey],
    ['audit', auditKey, complianceKey],
  ])('%s can presign its own read but cannot read another domain or write', async (user, allowed, forbidden) => {
    const storage = new ObjectStorageClient(credentials(user));
    const url = await storage.getSignedDownloadUrl({ storageBucket: bucket, storageKey: allowed, expiresInSeconds: 600 });
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('fictional test document');
    await expect(storage.getFileStream({ storageBucket: bucket, storageKey: forbidden })).rejects.toMatchObject({ name: 'AccessDenied' });
    await expect(storage.uploadFile({
      storageBucket: bucket, storageKey: allowed, contentType: 'application/pdf', metadata: {}, pdfBuffer: Buffer.from('overwrite'),
    })).rejects.toMatchObject({ name: 'AccessDenied' });
  });

  it.each(['pdf', 'esign'])('%s can read and write permitted prefixes but cannot delete or access others', async (user) => {
    const storage = new ObjectStorageClient(credentials(user));
    const client = s3(user);
    const key = `compliance/transfers/AUTHORIZATION/${id}-${user}.pdf`;
    try {
      await expect(storage.getFileStream({ storageBucket: bucket, storageKey: key })).rejects.toBeInstanceOf(ObjectNotFoundError);
      const request = { storageBucket: bucket, storageKey: key, contentType: 'application/pdf', metadata: { 'request-sha256': 'fingerprint' }, ifNotExists: true };
      await storage.uploadFile({ ...request, pdfBuffer: Buffer.from(user) });
      await expect(storage.uploadFile({ ...request, pdfBuffer: Buffer.from('overwrite') })).rejects.toBeInstanceOf(ObjectAlreadyExistsError);
      const object = await storage.getFileStream({ storageBucket: bucket, storageKey: key });
      expect(object.metadata?.['request-sha256']).toBe('fingerprint');
      object.stream.destroy();
      for (const storageKey of [
        `compliance/drafts/${id}-${user}.pdf`,
        `audit/transfers/1/overview-v1/${id}-${user}.pdf`,
      ]) {
        await storage.uploadFile({ ...request, storageKey, pdfBuffer: Buffer.from(user) });
        const stored = await storage.getFileStream({ storageBucket: bucket, storageKey });
        stored.stream.destroy();
      }
      await expect(client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))).rejects.toMatchObject({ name: 'AccessDenied' });
      await expect(storage.uploadFile({
        ...request, storageKey: `other/${id}.pdf`, pdfBuffer: Buffer.from(user),
      })).rejects.toMatchObject({ name: 'AccessDenied' });
      await expect(client.send(new ListObjectsV2Command({ Bucket: bucket }))).rejects.toMatchObject({ name: 'AccessDenied' });
      await expect(client.send(new ListBucketsCommand({}))).rejects.toMatchObject({ name: 'AccessDenied' });
      await expect(client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'compliance/transfers/' }))).resolves.toBeDefined();
    } finally {
      client.destroy();
    }
  });
});
