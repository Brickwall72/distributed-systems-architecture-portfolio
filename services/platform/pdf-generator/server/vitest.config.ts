// services/platform/pdf-generator/server/vitest.config.ts
/**
 * Vitest configuration for the pdf-generator server test suite.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 15000,
    setupFiles: ['@shared/testing/setup'],
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      S3_ACCESS_KEY: 'test-access-key',
      S3_SECRET_KEY: 'test-secret-key',
      S3_ENDPOINT: 'http://minio:9000',
      S3_REGION: 'us-east-1',
      DOCUMENT_BUCKET: 'drafts',
    },
  },
});
