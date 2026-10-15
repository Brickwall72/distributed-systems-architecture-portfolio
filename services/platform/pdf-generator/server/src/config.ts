// File: services/platform/pdf-generator/server/src/config/config.ts
import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NATS_URL: z.string().default('nats://localhost:4222'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Internal Storage Config (for container-to-container calls)
  S3_ENDPOINT: z.string().url().default('http://minio:9000'),
  // ✅ Public Storage Config (for browser-resolvable pre-signed URLs)
  S3_PUBLIC_ENDPOINT: z.string().url().default('http://localhost:9000'),

  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  DOCUMENT_BUCKET: z.string().default('dsap'),
});

export const env = envSchema.parse(process.env);