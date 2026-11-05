// File: services/platform/auth-service/shared/src/contracts/auth.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema } from '@contracts/common';
import { identitySchema } from '@contracts/auth';

const c = initContract();

export const sessionRequestSchema = z.object({ identityId: z.string().min(1) });
export const sessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  identity: identitySchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** GET /identities/me/signature is a plain binary route (image/svg+xml), outside this JSON contract. */
export const SIGNATURE_PATH = '/identities/me/signature';

export const authContract = c.router({
  getIdentities: {
    method: 'GET',
    path: '/identities',
    responses: { 200: z.array(identitySchema), 500: ApiErrorResponseSchema },
    summary: 'List the identities available for dev login.',
  },
  createSession: {
    method: 'POST',
    path: '/session',
    body: sessionRequestSchema,
    responses: {
      200: sessionResponseSchema,
      403: ApiErrorResponseSchema,
      404: ApiErrorResponseSchema,
      429: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Mint a short-lived access token for a seeded identity (dev login).',
  },
});
