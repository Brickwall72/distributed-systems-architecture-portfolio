// File: services/platform/auth-service/server/src/config.ts
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Dev login mints tokens for anyone who asks; it must be switched on explicitly. */
  AUTH_DEV_LOGIN: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  AUTH_PRIVATE_KEY_FILE: z.string().optional(),
  AUTH_PRIVATE_KEY: z.string().optional(),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_SESSION_RATE_LIMIT: z.coerce.number().int().positive().default(20),
});

export const env = envSchema.parse(process.env);

/** Prefers a mounted secret file; the inline env var exists for local development only. */
export const loadPrivateKeyPem = (): string => {
  if (env.AUTH_PRIVATE_KEY_FILE) return readFileSync(env.AUTH_PRIVATE_KEY_FILE, 'utf8');
  if (env.AUTH_PRIVATE_KEY) return env.AUTH_PRIVATE_KEY.replace(/\\n/g, '\n');
  throw new Error('AUTH_PRIVATE_KEY_FILE (or AUTH_PRIVATE_KEY for local dev) must be set');
};
