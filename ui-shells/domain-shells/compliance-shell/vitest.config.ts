// File: ui-shells/domain-shells/compliance-shell/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['@shared/testing/setup'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
