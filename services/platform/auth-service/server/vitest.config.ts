// services/platform/auth-service/server/vitest.config.ts
/**
 * Vitest configuration for the auth-service server test suite.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['@shared/testing/setup'],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
