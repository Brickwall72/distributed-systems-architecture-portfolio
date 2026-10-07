// File: packages/contracts/topology/src/inputs/AssetSelector.schema.ts
import { z } from 'zod';
import { type AssetBase } from '../outputs';

/**
 * Runtime input configuration passed from Shell -> AssetSelector MFE Widget.
 */
export const AssetSelectorInputSchema = z.object({
  filterOwnerId: z.string().trim().min(1).optional(),
  excludeOwnerId: z.string().trim().min(1).optional(),
  multiSelect: z.boolean().default(false),
  sameOwner: z.boolean().default(true),
});

/**
 * Raw input shape expected from the Shell caller.
 * `multiSelect` and `sameOwner` are optional (`boolean | undefined`).
 */
export type AssetSelectorInputs = z.input<typeof AssetSelectorInputSchema>;

/**
 * Parsed shape consumed inside the Widget.
 * `multiSelect` and `sameOwner` are guaranteed `boolean` defaults.
 */
export type ParsedAssetSelectorInputs = z.output<typeof AssetSelectorInputSchema>;

/**
 * Global Contract for the AssetSelector MFE Component props.
 */
export type AssetSelectorProps = AssetSelectorInputs & {
  /**
   * Selection event handler.
   * Always emits an array (`AssetBase[]`) to ensure predictable processing in the Shell:
   * - Single-select: `[selectedAsset]` or `[]`
   * - Multi-select: `[assetA, assetB]` or `[]`
   */
  readonly onSelect: (selectedAssets: AssetBase[]) => void;
};