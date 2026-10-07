// File: services/core/topology-service/server/src/schemas/DTO/asset.dto.schema.ts
import { AssetBaseSchema } from '@contracts/topology';
import { z } from 'zod';

export const AssetDTOSchema = AssetBaseSchema.extend({
  nomenclature: z.string(),
  serialNumber: z.string(),
  currentOwnerId: z.string().optional(),
});

export type AssetDTO = z.infer<typeof AssetDTOSchema>;

/**
 * Export collection schema directly from the shared contract package
 */
export const AssetDTOListSchema = z.array(AssetDTOSchema);
export type AssetDTOList = z.infer<typeof AssetDTOListSchema>;