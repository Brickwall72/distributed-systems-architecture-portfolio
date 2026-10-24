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
      const pdfBuffer = Buffer.from('mock document payload');
      const expectedHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      const result = await inMemoryClient.uploadFile({
        storageBucket: 'test-bucket',
        storageKey: 'docs/test.pdf',
        pdfBuffer,
        contentType: 'application/pdf',
        metadata: { 'test-key': 'test-value' },
      });

      expect(result).toEqual({
        fileHash: expectedHash,
        uploadedAt: expect.any(String),
      });

      expect(inMemoryClient.storage.has('test-bucket/docs/test.pdf')).toBe(true);
      const item = inMemoryClient.storage.get('test-bucket/docs/test.pdf');
      expect(item?.buffer).toEqual(pdfBuffer);
      expect(item?.contentType).toBe('application/pdf');
      expect(item?.metadata).toEqual({ 'test-key': 'test-value' });
    });
  });

  describe('getFileStream', () => {
    it('returns readable stream for existing stored item', async () => {
      const pdfBuffer = Buffer.from('hello world stream');
      await inMemoryClient.uploadFile({
        storageBucket: 'test-bucket',
        storageKey: 'docs/stream-test.txt',
        pdfBuffer,
        contentType: 'text/plain',
        metadata: {},
      });

      const result = await inMemoryClient.getFileStream({
        storageBucket: 'test-bucket', 
        storageKey: 'docs/stream-test.txt'
      });

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
        inMemoryClient.getFileStream({storageBucket: 'test-bucket', storageKey: 'non-existent.pdf'})
      ).rejects.toThrow('File not found or empty: s3://test-bucket/non-existent.pdf');
    });
  });

  describe('clear', () => {
    it('empties internal map storage when clear is called', async () => {
      await inMemoryClient.uploadFile({
        storageBucket: 'test-bucket',
        storageKey: 'file1.pdf',
        pdfBuffer: Buffer.from('file 1'),
        contentType: 'application/pdf',
        metadata: {},
      });

      expect(inMemoryClient.storage.size).toBe(1);

      inMemoryClient.clear();

      expect(inMemoryClient.storage.size).toBe(0);
    });
  });
});