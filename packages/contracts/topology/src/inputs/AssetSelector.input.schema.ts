// File: packages/contracts/topology/src/inputs/AssetSelector.input.schema.ts
import { z } from 'zod';
import { type AssetDTOList } from '../outputs';

/**
 * Reusable base asset query parameters.
 * Defined once here as the single source of truth for asset filtering.
 */
export const GetAssetsQuerySchema = z.object({
  filterOwnerId: z.string().trim().min(1).optional(),
  excludeOwnerId: z.string().trim().min(1).optional(),
  includeInTransit: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    },
    z.boolean().optional().default(false)
  ),
});

export type GetAssetsQuery = z.infer<typeof GetAssetsQuerySchema>;

/**
 * Runtime input schema enforced at the MFE boundary.
 * Combines the base query parameters with MFE-specific UI presentation props.
 */
export const AssetSelectorInputSchema = GetAssetsQuerySchema.extend({
  label: z.string().trim().min(1).optional(),
  multiSelect: z.boolean().default(false),
});

// ============================================================================
//       HOST SHELL INGRESS CONTRACT (Unparsed Inputs & External Props)
// ============================================================================

/**
 * Raw input parameters accepted from the Host Shell.
 */
export type AssetSelectorInputs = z.input<typeof AssetSelectorInputSchema>;

/**
 * Complete public props API exposed by the `AssetSelector` MFE to host containers.
 */
export type AssetSelectorProps = AssetSelectorInputs & {
  /**
   * Selection event handler invoked on state change.
   * Always emits a list array (`AssetDTOList`) to enforce List Collection uniformity.
   */
  readonly onSelect: (selectedAssets: AssetDTOList) => void;
};