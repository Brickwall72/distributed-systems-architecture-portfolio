// services/platform/pdf-generator/server/vitest.config.ts
/**
 * Vitest configuration for the pdf-generator server test suite.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['@shared/testing/setup'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
