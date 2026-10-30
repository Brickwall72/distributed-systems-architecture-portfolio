// File: services/core/topology-service/server/src/domain/asset.entity.ts
import { assetStatusEnum, controlTypeEnum } from "@contracts/topology";
import { z } from 'zod';

export const assetEntitySchema = z.object({
  id: z.string(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  currentOwnerId: z.string(),
  status: assetStatusEnum,
  type: z.string(),
  controlType: controlTypeEnum,
})
export type AssetEntity = z.infer<typeof assetEntitySchema>;

export type { ControlType, AssetStatus } from '@contracts/topology';