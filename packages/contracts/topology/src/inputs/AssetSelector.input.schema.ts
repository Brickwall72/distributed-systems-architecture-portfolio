// File: packages/contracts/topology/src/inputs/AssetSelector.input.schema.ts
import { z } from 'zod';
import { type AssetDTO } from '../outputs';

/**
 * Runtime input schema enforced at the MFE boundary.
 * Defines defaults for optional UI behavior flags.
 */
export const AssetSelectorInputSchema = z.object({
  filterOwnerId: z.string().trim().min(1).optional(),
  excludeOwnerId: z.string().trim().min(1).optional(),
  multiSelect: z.boolean().default(false),
  sameOwner: z.boolean().default(true),
});

// ============================================================================
//       HOST SHELL INGRESS CONTRACT (Unparsed Inputs & External Props)
// ============================================================================

/**
 * Raw input parameters accepted from the Host Shell.
 * Optional boolean flags (`multiSelect`, `sameOwner`) may be left `undefined` by the caller.
 */
export type AssetSelectorInputs = z.input<typeof AssetSelectorInputSchema>;

/**
 * Complete public props API exposed by the `AssetSelector` MFE to host containers.
 * Combines raw ingress parameters with required event callback bindings.
 */
export type AssetSelectorProps = AssetSelectorInputs & {
  /**
   * Selection event handler invoked on state change.
   * Always emits a list array (`AssetDTO[]`) to enforce List Collection uniformity:
   * - Single-select: `[selectedAsset]` or `[]`
   * - Multi-select: `[assetA, assetB]` or `[]`
   */
  readonly onSelect: (selectedAssets: AssetDTO[]) => void;
};