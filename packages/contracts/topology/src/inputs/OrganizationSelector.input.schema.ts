// File: packages/contracts/topology/src/inputs/OrganizationSelector.input.schema.ts
import { z } from 'zod';
import { type OrganizationDTO } from '../outputs';

/**
 * Reusable base organization query parameters.
 * Defined once here as the single source of truth for organization filtering.
 */
export const GetOrganizationsQuerySchema = z.object({
  filterOwnedId: z.string().trim().min(1).optional(),
  requireActiveAssets: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    },
    z.boolean().optional().default(false)
  ),
});

export type GetOrganizationsQuery = z.infer<typeof GetOrganizationsQuerySchema>;

/**
 * Runtime input configuration passed from Shell -> OrganizationSelector MFE Widget.
 * Combines the base query parameters with MFE-specific UI presentation props.
 */
export const OrganizationSelectorInputSchema = GetOrganizationsQuerySchema.extend({
  label: z.string().trim().min(1).optional(),
  excludeOrgId: z.string().trim().min(1).optional(),
  multiSelect: z.boolean().default(false),
});

/*
 * ============================================================================
 *        HOST SHELL INGRESS CONTRACT (Unparsed Inputs & External Props)
 * ============================================================================
 */

/**
 * Raw input shape expected from the Shell caller.
 * `multiSelect` and `requireActiveAssets` are optional.
 */
export type OrganizationSelectorInputs = z.input<typeof OrganizationSelectorInputSchema>;

/**
 * Global Contract for the OrganizationSelector MFE Component props.
 */
export type OrganizationSelectorProps = OrganizationSelectorInputs & {
  /**
   * Selection event handler.
   * Always emits an array (`OrganizationDTO[]`) to ensure predictable processing in the Shell:
   * - Single-select: `[selectedOrganization]` or `[]`
   * - Multi-select: `[OrganizationA, OrganizationB]` or `[]`
   */
  readonly onSelect: (selectedOrganizations: OrganizationDTO[]) => void;
};