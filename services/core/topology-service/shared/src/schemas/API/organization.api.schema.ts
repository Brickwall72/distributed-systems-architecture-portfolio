// File: services/core/topology-service/shared/src/schemas/API/asset.api.schema.ts
import { z } from 'zod';

/**
 * Shared HTTP GET /assets Query Parameters Schema
 */
export const GetOrganizationsQuerySchema = z.object({
  filterOwnedId: z.string().trim().min(1).optional(),
});

export type GetOrganizationsQuery = z.infer<typeof GetOrganizationsQuerySchema>;