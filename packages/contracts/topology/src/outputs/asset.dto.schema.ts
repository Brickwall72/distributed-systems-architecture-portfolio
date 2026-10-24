// File: packages/contracts/topology/src/outputs/asset.dto.schema.ts
import { z } from 'zod';

export const AssetStatusEnum = z.enum(['AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE']);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

export const AssetItemSchema = z.object({
  id: z.string(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  status: AssetStatusEnum.default('AVAILABLE'),
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