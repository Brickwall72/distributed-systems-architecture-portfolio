// File: packages/contracts/topology/src/outputs/asset.dto.schema.ts
import { z } from 'zod';

// ==========================================
//       PUBLIC DOMAIN ASSET CONTRACT
// ==========================================
/**
 * Canonical domain schema representing physical or logical assets managed by the Topology Service.
 *
 * Exposed via `@contracts/topology` for consumption by host shells and downstream microservices
 * (e.g., Compliance Service PDF generation engines).
 *
 * @property id - Primary domain identifier (UUID / URI format)
 * @property name - Primary display label
 * @property nomenclature - Formal military/defense naming nomenclature
 * @property serialNumber - Equipment serial identifier
 * @property currentOwnerId - Optional foreign key referring to the holding Organization ID
 */
export const AssetDTOSchema = z.object({
  id: z.string().trim().min(1, 'Asset ID is required'),
  name: z.string().trim().min(1, 'Asset name is required'),
  nomenclature: z.string().trim().min(1, 'Asset nomenclature is required'),
  serialNumber: z.string().trim().min(1, 'Asset serial number is required'),
  currentOwnerId: z
    .string()
    .trim()
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
});

export type AssetDTO = z.infer<typeof AssetDTOSchema>;

/**
 * Collection contract for bulk queries, collection endpoints, and multi-asset selection outputs.
 */
export const AssetDTOListSchema = z.array(AssetDTOSchema);
export type AssetDTOList = z.infer<typeof AssetDTOListSchema>;