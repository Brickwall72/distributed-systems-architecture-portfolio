// File: packages/vite-config/src/index.ts
import { defineConfig, UserConfig, ServerOptions, PreviewOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';

interface RemoteConfigOptions {
  name: string;
  port: number;
  exposes?: Record<string, string>; // Optional: not needed for global-shell
  remotes?: Record<string, any>;    // Optional: other remotes this app consumes
  proxy?: ServerOptions['proxy'];   // Optional: local backen proxy rules
  preview?: PreviewOptions;         // Optional: configures the 'vite preview' server
}

export function createRemoteConfig(options: RemoteConfigOptions): UserConfig {
  return defineConfig({
    server: {
      port: options.port,
      host: '0.0.0.0',
      strictPort: true,
      cors: true,
      origin: `http://localhost:${options.port}`,
      // Conditionally inject proxy rules if provided
      ...(options.proxy && { proxy: options.proxy }),
    },
    // Conditionally inject preview options if provided
    ...(options.preview && { preview: options.preview }),
    plugins: [
      react(),
      tailwindcss(), // Tailwind v4 plugin built-in globally
      federation({
        name: options.name,
        filename: 'remoteEntry.js',
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
  });
}