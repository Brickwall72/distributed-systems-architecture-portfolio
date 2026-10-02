// File: services/platform/esign-service/client/vite.config.ts
import { createLibraryConfig } from '@shared/vite-config';

export default createLibraryConfig({
  entryPath: './src/index.ts',
  name: 'EsignClient',
  external: ['@contracts/esign'], // Keep contract packages external to avoid duplicating Zod schemas
});