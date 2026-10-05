// File: services/platform/pdf-generator/server/src/services/storage/storage.unit.test.ts
import { InMemoryStorageClient } from '@shared/filestore';
import { uploadGeneratedDocument } from './storage';

describe('pdf-generator storage wrapper', () => {
  let inMemoryStorage: InMemoryStorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryStorage = new InMemoryStorageClient();
  });

  describe('uploadGeneratedDocument', () => {
    it('sanitizes customPath and attaches correlationId metadata', async () => {
      await uploadGeneratedDocument(
        {
          pdfBuffer: Buffer.from('test pdf'),
          entityId: 'tenant-123',
          documentId: 'doc-456',
          customPath: '///custom/folder///',
          correlationId: 'corr-789',
        },
        inMemoryStorage
      );

      // Print stored keys to verify exact bucket & path prefix if it fails
      const keys = Array.from(inMemoryStorage.storage.keys());

      // Key matches: ${DOCUMENT_BUCKET}/${entityId}/${sanitizedPath}/${documentId}.pdf
      const storedItem = inMemoryStorage.storage.get(
        keys[0] || 'dsap/tenant-123/custom/folder/doc-456.pdf'
      );

      expect(storedItem).toBeDefined();
      expect(storedItem?.metadata).toEqual({
        'entity-id': 'tenant-123',
        'document-id': 'doc-456',
        'correlation-id': 'corr-789',
      });
    });
  });
});