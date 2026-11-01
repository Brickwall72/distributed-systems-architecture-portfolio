// File: packages/contracts/topology/src/outputs/asset.dto.schema.ts
import { z } from 'zod';

export const CONTROL_TYPE = {
  LOCAL: 'LOCAL',
  REMOTE: 'REMOTE',
} as const
export const controlTypeEnum = z.enum(
  Object.values(CONTROL_TYPE) as [
    (typeof CONTROL_TYPE)[keyof typeof CONTROL_TYPE], 
    ...(typeof CONTROL_TYPE)[keyof typeof CONTROL_TYPE][]
  ]
);
export type ControlType = z.infer<typeof controlTypeEnum>;

export const ASSET_STATUS = {
  AVAILABLE: 'AVAILABLE',
  IN_TRANSIT: 'IN_TRANSIT',
} as const
export const assetStatusEnum = z.enum(
  Object.values(ASSET_STATUS) as [
    (typeof ASSET_STATUS)[keyof typeof ASSET_STATUS], 
    ...(typeof ASSET_STATUS)[keyof typeof ASSET_STATUS][]
  ]
);
export type AssetStatus = z.infer<typeof assetStatusEnum>;

export const AssetItemSchema = z.object({
  id: z.string(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  status: assetStatusEnum.default(ASSET_STATUS.AVAILABLE),
  type: z.string(),
  controlType: controlTypeEnum,
  /** Set when the asset is IN_TRANSIT on an open transfer event. */
  requisitionNumber: z.string().optional(),
});
export type AssetItemDTO = z.infer<typeof AssetItemSchema>;
export const AssetItemDTOListSchema = z.array(AssetItemSchema);
export type AssetItemDTOList = z.infer<typeof AssetItemDTOListSchema>;

/**
 * Canonical domain schema representing physical or logical assets managed by the Topology Service.
 * Assets must always have a holding organization (currentOwnerId).
 */
export const AssetDTOSchema = AssetItemSchema.extend({
  name: z.string().trim().min(1, 'Asset name is required'),
  currentOwnerId: z.string().trim().min(1, 'Holding organization owner ID is required'),
});
export type AssetDTO = z.infer<typeof AssetDTOSchema>;

export const AssetDTOListSchema = z.array(AssetDTOSchema);
export type AssetDTOList = z.infer<typeof AssetDTOListSchema>;