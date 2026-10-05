// File: packages/file-storage/src/in-ememory-storage-client/in-ememory-storage-client.unit.test.ts
import crypto from 'node:crypto';
import { InMemoryStorageClient } from './in-memory-storage-client';

describe('InMemoryStorageClient (Testing Adapter)', () => {
  let inMemoryClient: InMemoryStorageClient;

  beforeEach(() => {
    inMemoryClient = new InMemoryStorageClient();
  });

  describe('uploadFile', () => {
    it('stores buffer in memory map and returns valid UploadResult', async () => {
      const fileBuffer = Buffer.from('mock document payload');
      const expectedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const result = await inMemoryClient.uploadFile({
        bucket: 'test-bucket',
        key: 'docs/test.pdf',
        fileBuffer,
        contentType: 'application/pdf',
        metadata: { 'test-key': 'test-value' },
      });

      expect(result).toEqual({
        s3Uri: 's3://test-bucket/docs/test.pdf',
        bucket: 'test-bucket',
        key: 'docs/test.pdf',
        fileHash: expectedHash,
        uploadedAt: expect.any(String),
      });

      expect(inMemoryClient.storage.has('test-bucket/docs/test.pdf')).toBe(true);
      const item = inMemoryClient.storage.get('test-bucket/docs/test.pdf');
      expect(item?.buffer).toEqual(fileBuffer);
      expect(item?.contentType).toBe('application/pdf');
      expect(item?.metadata).toEqual({ 'test-key': 'test-value' });
    });
  });

  describe('getFileStream', () => {
    it('returns readable stream for existing stored item', async () => {
      const fileBuffer = Buffer.from('hello world stream');
      await inMemoryClient.uploadFile({
        bucket: 'test-bucket',
        key: 'docs/stream-test.txt',
        fileBuffer,
        contentType: 'text/plain',
      });

      const result = await inMemoryClient.getFileStream('test-bucket', 'docs/stream-test.txt');

      expect(result.contentType).toBe('text/plain');

      // Consume stream to verify contents match original buffer
      const chunks: Buffer[] = [];
      for await (const chunk of result.stream) {
        chunks.push(Buffer.from(chunk));
      }
      const readContent = Buffer.concat(chunks).toString('utf-8');

      expect(readContent).toBe('hello world stream');
    });

    it('throws error when requesting a key that does not exist in memory', async () => {
      await expect(
        inMemoryClient.getFileStream('test-bucket', 'non-existent.pdf')
      ).rejects.toThrow('File not found or empty: s3://test-bucket/non-existent.pdf');
    });
  });

  describe('clear', () => {
    it('empties internal map storage when clear is called', async () => {
      await inMemoryClient.uploadFile({
        bucket: 'test-bucket',
        key: 'file1.pdf',
        fileBuffer: Buffer.from('file 1'),
        contentType: 'application/pdf',
      });

      expect(inMemoryClient.storage.size).toBe(1);

      inMemoryClient.clear();

      expect(inMemoryClient.storage.size).toBe(0);
    });
  });
});