// File: packages/contracts/custody/src/nodes.ts
import { z } from 'zod';

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  currentOwnerId: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;