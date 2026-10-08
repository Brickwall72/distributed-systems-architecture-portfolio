// File: packages/contracts/topology/src/inputs/OrganizationSelector.input.schema.ts
import { z } from 'zod';
import { type OrganizationDTO } from '../outputs';

/**
 * Runtime input configuration passed from Shell -> OrganizationSelector MFE Widget.
 */
export const OrganizationSelectorInputSchema = z.object({
  filterOwnedId: z.string().trim().min(1).optional(),
  excludeOrgId: z.string().trim().min(1).optional(),
  multiSelect: z.boolean().default(false),
});

/*
 * ============================================================================
 *       HOST SHELL INGRESS CONTRACT (Unparsed Inputs & External Props)
 * ============================================================================
 */

/**
 * Raw input shape expected from the Shell caller.
 * `multiSelect` is optional (`boolean | undefined`).
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