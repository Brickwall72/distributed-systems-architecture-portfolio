// services/platform/esign-service/server/src/services/storage/storage.unit.test.ts
import { InMemoryStorageClient } from '@shared/filestore';

describe('esignature-service storage wrapper', () => {
  let inMemoryStorage: InMemoryStorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    inMemoryStorage = new InMemoryStorageClient();
  });

  describe('Initialization & Fail-Fast Behavior', () => {
    it('throws fatal error on import if credentials are missing', async () => {
      vi.stubEnv('S3_ACCESS_KEY', '');
      vi.stubEnv('S3_SECRET_KEY', '');

      vi.resetModules();

      await expect(import('./storage')).rejects.toThrow(
        'FATAL: S3_ACCESS_KEY and S3_SECRET_KEY must be provided via environment variables.'
      );
    });
  });

  describe('uploadSignedDocument', () => {
    it('sanitizes customPath and attaches correlationId metadata', async () => {
      vi.stubEnv('S3_ACCESS_KEY', 'test-access-key');
      vi.stubEnv('S3_SECRET_KEY', 'test-secret-key');

      // Re-evaluate storage.ts in an isolated module scope after setting env variables
      vi.resetModules();
      const { uploadSignedDocument } = await import('./storage');

      await uploadSignedDocument(
        {
          pdfBuffer: Buffer.from('test pdf'),
          entityId: 'tenant-123',
          documentId: 'doc-456',
          customPath: '///custom/folder///',
          correlationId: 'corr-789',
        },
        inMemoryStorage
      );

      const storedItem = inMemoryStorage.storage.get(
        'dsap/custom/folder/doc-456.pdf'
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