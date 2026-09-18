// File: packages/vite-config/src/index.ts
import { defineConfig, UserConfig, ServerOptions, PreviewOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RemoteConfigOptions {
  domain: string; // example: topology
  concern: string; // example: server
  port: number;
  exposes?: Record<string, string>; // Optional: not needed for global-shell
  remotes?: Record<string, any>;    // Optional: other remotes this app consumes
  proxy?: ServerOptions['proxy'];   // Optional: local backen proxy rules
  preview?: PreviewOptions;         // Optional: configures the 'vite preview' server
}

export function createRemoteConfig(options: RemoteConfigOptions): UserConfig {
  const basePath = (options.domain === "global" ? '' : '/' + options.domain) + '/' + (options.concern === 'shell' ? '' : options.concern + '/');

  return defineConfig({
    base: basePath,
    server: {
      port: options.port,
      host: '0.0.0.0',
      strictPort: true,
      cors: true,
      origin: process.env.VITE_ORIGIN || 'http://localhost:8081',
      // Conditionally inject proxy rules if provided
      ...(options.proxy && { proxy: options.proxy }),
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
        // manifest: true, // for advanced runtime loaders that dynamically discover assets/versions in production
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
      outDir: 'dist',
      assetsDir: 'assets',
      minify: false,
      cssCodeSplit: true, // Keeps federated CSS cleanly bundled
    },
    // Avoid using a predictable directory in the world-writable system temp directory.
    cacheDir: join(tmpdir(), `vite-cache-${options.domain}-${options.concern}`),
  });
}