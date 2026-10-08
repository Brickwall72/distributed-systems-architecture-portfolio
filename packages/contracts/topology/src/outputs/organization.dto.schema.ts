// File: packages/contracts/topology/src/outputs/organization.dto.schema.ts
import { z } from 'zod';

// ==========================================
//    PUBLIC DOMAIN ORGANIZATION CONTRACT
// ==========================================
/**
 * Canonical domain schema representing organizational entities (Contractors, Military Branches, Gov Agencies).
 *
 * Exposed via `@contracts/topology` for consumption by host shells, selection MFE widgets,
 * and downstream capability services.
 *
 * @property id - Primary domain key used for relationship evaluation and filtering
 * @property name - Official organization or unit name
 * @property type - High-level classification enum
 * @property addressLine1 - Primary physical or postal address line (sanitized)
 * @property addressLine2 - Secondary address details / suite / building number (sanitized)
 */
export const OrganizationDTOSchema = z.object({
  id: z.string().trim().min(1, 'Organization ID is required'),
  name: z.string().trim().min(1, 'Organization name is required'),
  type: z.enum(['CONTRACTOR', 'GOV', 'MILITARY_BRANCH']),
  addressLine1: z
    .string()
    .trim()
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
  addressLine2: z
    .string()
    .trim()
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
});

export type OrganizationDTO = z.infer<typeof OrganizationDTOSchema>;

/**
 * Collection contract for organization queries, gateway listings, and MFE outputs.
 */
export const OrganizationDTOListSchema = z.array(OrganizationDTOSchema);
export type OrganizationDTOList = z.infer<typeof OrganizationDTOListSchema>;