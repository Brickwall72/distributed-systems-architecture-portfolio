// File: packages/contract/topology/src/outputs/asset.ts
import { z } from 'zod';

// ==========================================
//         MINIMAL ASSET CONTRACT
// ==========================================
/**
 * Minimal shape required by the Shell for Assets.
 * - `id`: Primary domain key.
 * - `name`: Display label (mapped from `nomenclature` or `name` in Neo4j).
 * Extra fields like `serialNumber` or `type` are preserved automatically.
 */
export const AssetBaseSchema = z
  .object({
    id: z.string().min(1, 'Asset ID is required'),
    name: z.string().min(1, 'Asset name is required'),
  });

export type AssetBase = z.infer<typeof AssetBaseSchema>;

/**
 * Array contract for collection endpoints and selection outputs.
 */
export const AssetBaseListSchema = z.array(AssetBaseSchema);
export type AssetBaseList = z.infer<typeof AssetBaseListSchema>;