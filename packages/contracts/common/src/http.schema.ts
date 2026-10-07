// File: packages/contracts/common/src/http.schema.ts
import { z } from 'zod';

/**
 * Standard RFC 7807-adjacent Error Response Contract
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.array(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;