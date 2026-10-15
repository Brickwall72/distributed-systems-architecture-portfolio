// File: services/core/compliance-service/server/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NATS_URL: z.string().url().default('nats://localhost:4222'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // S3_ENDPOINT: z.string().url().default('http://minio.platform-local.svc.cluster.local:9000'),
  // S3_BUCKET: z.string().default('dsap'),
  // S3_ACCESS_KEY: z.string().min(1, 'S3 Access Key is required'),
  // S3_SECRET_KEY: z.string().min(1, 'S3 Secret Key is required'),
});

export const env = envSchema.parse(process.env);