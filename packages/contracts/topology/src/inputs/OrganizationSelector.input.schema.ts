// File: packages/contracts/topology/src/inputs/OrganizationSelector.input.schema.ts
import { z } from 'zod';
import { type OrganizationDTO, type OrganizationDTOList } from '../outputs';

export const TRANSFER_ROLE = {
  SENDER: 'SENDER',
  RECEIVER: 'RECEIVER',
} as const;
export const transferRoleEnum = z.enum(
  Object.values(TRANSFER_ROLE) as [typeof TRANSFER_ROLE[keyof typeof TRANSFER_ROLE], ...typeof TRANSFER_ROLE[keyof typeof TRANSFER_ROLE][]]
);

/**
 * Reusable base organization query parameters.
 * Defined once here as the single source of truth for organization filtering.
 */
export const GetOrganizationsQuerySchema = z.object({
  filterOwnedId: z.string().trim().min(1).optional(),
  excludeOrgId: z.string().trim().min(1).optional(),
  transferEventId: z.string().trim().min(1).optional(),
  transferEventRole: transferRoleEnum.optional(),
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
 * Discriminated on `multiSelect`, mirroring AssetSelector.
 */
const baseSelectorFields = {
  label: z.string().trim().min(1).optional(),
};

const SingleOrganizationSelectorInputSchema = GetOrganizationsQuerySchema.extend({
  ...baseSelectorFields,
  multiSelect: z.literal(false).optional().default(false),
});

const MultiOrganizationSelectorInputSchema = GetOrganizationsQuerySchema.extend({
  ...baseSelectorFields,
  multiSelect: z.literal(true),
});

export const OrganizationSelectorInputSchema = z.discriminatedUnion('multiSelect', [
  SingleOrganizationSelectorInputSchema,
  MultiOrganizationSelectorInputSchema,
]);

/*
 * ============================================================================
 *        HOST SHELL INGRESS CONTRACT (Unparsed Inputs & External Props)
 * ============================================================================
 */

export type OrganizationSelectorInputs = z.input<typeof OrganizationSelectorInputSchema>;

type SingleInput = z.input<typeof SingleOrganizationSelectorInputSchema>;
type MultiInput = z.input<typeof MultiOrganizationSelectorInputSchema>;

export type SingleOrganizationSelectorProps = Omit<SingleInput, 'multiSelect'> & {
  readonly multiSelect?: false;
  /** Emits the selected organization, or `undefined` when cleared. */
  readonly onSelect: (selectedOrganization: OrganizationDTO | undefined) => void;
};

export type MultiOrganizationSelectorProps = Omit<MultiInput, 'multiSelect'> & {
  readonly multiSelect: true;
  /** Emits all selected organizations (empty array when cleared). */
  readonly onSelect: (selectedOrganizations: OrganizationDTOList) => void;
};

export type OrganizationSelectorProps = SingleOrganizationSelectorProps | MultiOrganizationSelectorProps;
