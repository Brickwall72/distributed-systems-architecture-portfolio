// File: packages/contracts/topology/src/inputs/AssetSelector.input.schema.ts
import { z } from 'zod';
import { AssetDTO, AssetDTOList, controlTypeEnum } from '../outputs';

/**
 * Reusable base asset query parameters.
 */
const booleanFromString = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
]);

export const GetAssetsQuerySchema = z.object({
  filterOwnerId: z.string().trim().min(1).optional(),
  excludeOwnerId: z.string().trim().min(1).optional(),
  transferEventId: z.string().trim().min(1).optional(),
  filterControlType: controlTypeEnum.optional(),
  includeInTransit: booleanFromString.optional().default(false),
  includeAvailable: booleanFromString.optional().default(true),
});
export type GetAssetsQuery = z.infer<typeof GetAssetsQuerySchema>;

/**
 * Single-select configuration schema.
 */
const SingleAssetSelectorInputSchema = GetAssetsQuerySchema.extend({
  label: z.string().trim().min(1).optional(),
  includeInTransit: booleanFromString.optional().default(true),
  includeAvailable: booleanFromString.optional().default(true),
  multiSelect: z.literal(false).optional().default(false),
});

/**
 * Multi-select configuration schema.
 */
const MultiAssetSelectorInputSchema = GetAssetsQuerySchema.extend({
  label: z.string().trim().min(1).optional(),
  includeInTransit: booleanFromString.optional().default(true),
  includeAvailable: booleanFromString.optional().default(true),
  multiSelect: z.literal(true),
});

/**
 * Runtime input schema enforced at the MFE boundary (discriminated union).
 */
export const AssetSelectorInputSchema = z.discriminatedUnion('multiSelect', [
  SingleAssetSelectorInputSchema,
  MultiAssetSelectorInputSchema,
]);

export type AssetSelectorInputs = z.input<typeof AssetSelectorInputSchema>;

/**
 * Public props API exposed by the `AssetSelector` MFE to host containers.
 * Explicitly preserving optionality on inferred fields while enforcing the correct `onSelect` signature.
 */
type SingleInput = z.input<typeof SingleAssetSelectorInputSchema>;
type MultiInput = z.input<typeof MultiAssetSelectorInputSchema>;

export type SingleAssetSelectorProps = Omit<SingleInput, 'multiSelect' | 'includeInTransit' | 'includeAvailable'> & {
  readonly includeInTransit?: boolean;   // props shouldn't accept the string forms
  readonly includeAvailable?: boolean;
  readonly multiSelect?: false;
  readonly onSelect: (selectedAsset: AssetDTO | undefined) => void;
};

export type MultiAssetSelectorProps = Omit<MultiInput, 'multiSelect' | 'includeInTransit' | 'includeAvailable'> & {
  readonly includeInTransit?: boolean;
  readonly includeAvailable?: boolean;
  readonly multiSelect: true;
  readonly onSelect: (selectedAssets: AssetDTOList) => void;
};

export type AssetSelectorProps = SingleAssetSelectorProps | MultiAssetSelectorProps;