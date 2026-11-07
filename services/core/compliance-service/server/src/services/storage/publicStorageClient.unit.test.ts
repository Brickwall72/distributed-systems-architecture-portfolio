// File: services/platform/compliance-service/server/src/services/storage/publicStorageClient.unit.test.ts
describe('compliance public storage client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Initialization & Fail-Fast Behavior', () => {
    it('throws validation error on import if credentials are missing', async () => {
      vi.stubEnv('S3_ACCESS_KEY', '');
      vi.stubEnv('S3_SECRET_KEY', '');

      vi.resetModules();

      await expect(import('./publicStorageClient')).rejects.toThrow();
    });
  });

});
