// File: ui-shells/global-shell/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['@shared/testing/setup'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
