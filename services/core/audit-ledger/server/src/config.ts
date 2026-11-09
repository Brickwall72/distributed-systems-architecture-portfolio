// File: services/core/audit-ledger/server/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NATS_URL: z.string().url().default('nats://localhost:4222'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_HOST: z.string().default('audit-db'),
  DB_PORT: z.coerce.number().default(27017),
  DB_NAME: z.string().default('audit'),
  DB_AUTH_SOURCE: z.string().default('admin'),
  S3_PUBLIC_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
