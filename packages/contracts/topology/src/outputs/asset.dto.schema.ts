// File: packages/contracts/topology/src/outputs/asset.dto.schema.ts
import { z } from 'zod';

export const AssetStatusEnum = z.enum(['AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE']);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

/**
 * Canonical domain schema representing physical or logical assets managed by the Topology Service.
 * Assets must always have a holding organization (currentOwnerId).
 */
export const AssetDTOSchema = z.object({
  id: z.string().trim().min(1, 'Asset ID is required'),
  name: z.string().trim().min(1, 'Asset name is required'),
  nomenclature: z.string().trim().min(1, 'Asset nomenclature is required'),
  serialNumber: z.string().trim().min(1, 'Asset serial number is required'),
  status: AssetStatusEnum.default('AVAILABLE'),
  currentOwnerId: z.string().trim().min(1, 'Holding organization owner ID is required'),
});

export type AssetDTO = z.infer<typeof AssetDTOSchema>;

export const AssetDTOListSchema = z.array(AssetDTOSchema);
export type AssetDTOList = z.infer<typeof AssetDTOListSchema>;