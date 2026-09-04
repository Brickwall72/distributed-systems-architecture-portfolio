// File: packages/ui/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  css: {
    // Force Vite to use PostCSS for CSS transformation instead of LightningCSS
    transformer: 'postcss',
  },
  build: {
    cssMinify: 'esbuild',
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'SharedUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});