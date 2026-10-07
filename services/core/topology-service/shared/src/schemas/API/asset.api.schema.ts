// File: services/core/topology-service/shared/src/schemas/API/asset.api.schema.ts
import { z } from 'zod';

/**
 * Shared HTTP GET /assets Query Parameters Schema
 */
export const GetAssetsQuerySchema = z.object({
  filterOwnerId: z.string().trim().min(1).optional(),
  excludeOwnerId: z.string().trim().min(1).optional(),
});

export type GetAssetsQuery = z.infer<typeof GetAssetsQuerySchema>;