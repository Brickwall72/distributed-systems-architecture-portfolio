// File: packages/contract/topology/src/outputs/organization.ts
import { z } from 'zod';

// ==========================================
//       MINIMAL ORGANIZATION CONTRACT
// ==========================================
/**
 * Minimal shape required by the Shell for Organizations.
 * - `id`: Used for filtering (e.g., excludeOrgId, ownerOrgId).
 * - `name`: Used for basic UI dropdowns or breadcrumbs.
 * Uses `.passthrough()` so extra database fields (addressLine1, addressLine2, type) 
 * remain attached on the object in memory.
 */
export const OrganizationBaseSchema = z
  .object({
    id: z.string().min(1, 'Organization ID is required'),
    name: z.string().min(1, 'Organization name is required'),
  });

export type OrganizationBase = z.infer<typeof OrganizationBaseSchema>;

/**
 * Array contract for collection endpoints and selection outputs.
 */
export const OrganizationBaseListSchema = z.array(OrganizationBaseSchema);
export type OrganizationBaseList = z.infer<typeof OrganizationBaseListSchema>;