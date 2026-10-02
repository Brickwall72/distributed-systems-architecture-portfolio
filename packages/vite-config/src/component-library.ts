// File: packages/vite-config/src/component-library.ts
import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {  resolve } from 'node:path';

export interface LibraryConfigOptions {
  entryPath: string;
  name: string;
  external?: string[];
}

export function createLibraryConfig(options: LibraryConfigOptions): UserConfig {
  const externalDeps = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    ...(options.external || []),
  ];

  return defineConfig({
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      cssMinify: 'esbuild',
      lib: {
        entry: resolve(options.entryPath),
        name: options.name,
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: externalDeps,
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
  });
}