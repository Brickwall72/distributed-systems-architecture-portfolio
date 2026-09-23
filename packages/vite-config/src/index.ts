// File: packages/vite-config/src/index.ts
import { defineConfig, UserConfig, PreviewOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RemoteConfigOptions {
  domain: string; // example: topology
  concern: string; // example: server
  exposes?: Record<string, string>; // Optional: not needed for global-shell
  remotes?: Record<string, any>;    // Optional: other remotes this app consumes
  preview?: PreviewOptions;         // Optional: configures the 'vite preview' server
}

export function createRemoteConfig(options: RemoteConfigOptions): UserConfig {
  let basePath: string;
  if (options.domain === 'global') {
    basePath = '/';
  } else if (options.concern === 'shell') {
    basePath = `/${options.domain}-shell`;
  } else {
    basePath = `/${options.domain}/${options.concern}`;
  }

  return defineConfig({
    base: basePath,
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      cors: true,
      origin: process.env.VITE_ORIGIN || 'http://localhost',
    },
    // Conditionally inject preview options if provided
    ...(options.preview && { preview: options.preview }),
    plugins: [
      react(),
      tailwindcss(), // Tailwind v4 plugin built-in globally
      federation({
        name: `${options.domain}_${options.concern}`,
        ...(options.domain !== 'global' && {filename: `remoteEntry.js`}),
        dts: false,
        manifest: true, // for advanced runtime loaders that dynamically discover assets/versions in production
        publicPath: basePath,
        ...(options.exposes && { exposes: options.exposes }),
        ...(options.remotes && { remotes: options.remotes }),
        shared: {
          react: {
            singleton: true,
            requiredVersion: '~19.2.8',
            eager: false,
          },
          'react-dom': {
            singleton: true,
            requiredVersion: '~19.2.8',
            eager: false,
          },
          'react/jsx-runtime': {
            singleton: true,
            requiredVersion: '~19.2.8',
            eager: false,
          },
        },
      }),
    ],
    build: {
      target: 'esnext',
      minify: false,
      cssCodeSplit: false, // Keeps federated CSS cleanly bundled
    },
    // Avoid using a predictable directory in the world-writable system temp directory.
    cacheDir: join(tmpdir(), `vite-cache-${options.domain}-${options.concern}`),
  });
}