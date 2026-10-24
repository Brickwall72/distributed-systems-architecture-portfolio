import { InMemoryStorageClient, uploadFileRequestSchema, uploadFileResultSchema } from '@shared/filestore';
import { mockFromSchema } from '@shared/testing';

describe('esign-service storage wrapper', () => {
  let inMemoryStorage: InMemoryStorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    inMemoryStorage = new InMemoryStorageClient();
  });

  describe('Initialization & Fail-Fast Behavior', () => {
    it('throws validation error on import if credentials are missing', async () => {
      vi.stubEnv('S3_ACCESS_KEY', '');
      vi.stubEnv('S3_SECRET_KEY', '');

      vi.resetModules();

      await expect(import('./storage')).rejects.toThrow();
    });
  });

  describe('uploadSignedDocument', () => {
    it('uploads the schema-generated payload as a PDF through the supplied client', async () => {
      vi.stubEnv('S3_ACCESS_KEY', 'test-access-key');
      vi.stubEnv('S3_SECRET_KEY', 'test-secret-key');

      vi.resetModules();
      const { uploadSignedDocument, uploadSignedDocumentParamsSchema } = await import('./storage');

      const request = mockFromSchema(uploadFileRequestSchema.omit({ contentType: true }), {
        pdfBuffer: Buffer.from('test pdf'),
      });
      const params = uploadSignedDocumentParamsSchema.parse({ ...request, client: inMemoryStorage });

      const result = await uploadSignedDocument(params);

      expect(uploadFileResultSchema.parse(result)).toEqual(result);
      const storedItem = inMemoryStorage.storage.get(`${request.storageBucket}/${request.storageKey}`);
      expect(storedItem?.contentType).toBe('application/pdf');
      expect(storedItem?.metadata).toEqual(request.metadata);
    });
  });
});
