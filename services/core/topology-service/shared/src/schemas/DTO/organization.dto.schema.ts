// File: services/core/topology-service/server/src/schemas/DTO/organization.dto.schema.ts
import { OrganizationBaseSchema } from '@contracts/topology';
import { z } from 'zod';

export const OrganizationDTOSchema = OrganizationBaseSchema.extend({
  type: z.enum(['CONTRACTOR', 'GOV', 'MILITARY_BRANCH']),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});

export type OrganizationDTO = z.infer<typeof OrganizationDTOSchema>;

/**
 * Export collection schema directly from the shared contract package
 */
export const OrganizationDTOListSchema = z.array(OrganizationDTOSchema);
export type OrganizationDTOList = z.infer<typeof OrganizationDTOListSchema>;