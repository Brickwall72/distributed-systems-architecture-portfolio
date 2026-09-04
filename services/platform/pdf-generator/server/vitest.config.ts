// File: services/platform/pdf-generator/server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Prevent vitest from scanning compiled output in dist/
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});