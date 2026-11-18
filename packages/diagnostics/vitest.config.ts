import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', setupFiles: ['@shared/testing/setup'], include: ['src/**/*.unit.test.ts'] },
});