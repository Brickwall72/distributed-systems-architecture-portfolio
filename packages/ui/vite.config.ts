// File: packages/ui/vite.config.ts
import { createLibraryConfig } from '@shared/vite-config';

export default createLibraryConfig({
  entryPath: './src/index.ts',
  name: 'SharedUI',
});