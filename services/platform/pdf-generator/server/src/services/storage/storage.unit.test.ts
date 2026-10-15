// File: services/platform/pdf-generator/server/src/services/storage/storage.unit.test.ts
import { InMemoryStorageClient } from '@shared/filestore';
import { uploadGeneratedDocument } from './storage';
import { env } from '../../config';

describe('pdf-generator storage wrapper', () => {
  let inMemoryStorage: InMemoryStorageClient;

  beforeEach(() => {
    inMemoryStorage = new InMemoryStorageClient();
  });

  describe('uploadGeneratedDocument', () => {
    it('sanitizes customPath, attaches correlationId metadata, and returns correct upload result', async () => {
      const result = await uploadGeneratedDocument(
        {
          pdfBuffer: Buffer.from('test pdf content'),
          entityId: 'tenant-123',
          documentId: 'doc-456',
          customPath: '///custom/folder///',
          correlationId: 'corr-789',
        },
        inMemoryStorage
      );

      const bucket = env.DOCUMENT_BUCKET;

      // Verify returned upload metadata structure
      expect(result).toEqual(
        expect.objectContaining({
          s3Uri: `s3://${bucket}/tenant-123/custom/folder/doc-456.pdf`,
          bucket,
          key: 'tenant-123/custom/folder/doc-456.pdf',
          fileHash: expect.any(String),
          uploadedAt: expect.any(String),
        })
      );

      // Verify item exists in storage with correct content-type and metadata
      const storedItem = inMemoryStorage.storage.get(`${bucket}/tenant-123/custom/folder/doc-456.pdf`);
      expect(storedItem).toBeDefined();
      expect(storedItem?.contentType).toBe('application/pdf');
      expect(storedItem?.metadata).toEqual({
        'entity-id': 'tenant-123',
        'document-id': 'doc-456',
        'correlation-id': 'corr-789',
      });
    });

    it('correctly builds object key when customPath is omitted', async () => {
      const result = await uploadGeneratedDocument(
        {
          pdfBuffer: Buffer.from('plain pdf content'),
          entityId: 'tenant-999',
          documentId: 'doc-888',
        },
        inMemoryStorage
      );

      const bucket = env.DOCUMENT_BUCKET;

      expect(result.s3Uri).toBe(`s3://${bucket}/tenant-999/doc-888.pdf`);

      const storedItem = inMemoryStorage.storage.get(`${bucket}/tenant-999/doc-888.pdf`);
      expect(storedItem).toBeDefined();
      expect(storedItem?.metadata).toEqual({
        'entity-id': 'tenant-999',
        'document-id': 'doc-888',
      });
    });
  });
});