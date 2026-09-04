// services/platform/pdf-generator/client/vitest.config.ts (or vite.config.ts)
/**
 * Vitest configuration for the topology client test suite.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.unit.test.{ts,tsx}'],
  },
});
