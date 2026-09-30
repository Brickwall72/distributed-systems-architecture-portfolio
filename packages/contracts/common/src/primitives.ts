// File: packages/contracts/common/src/primitives.ts
import { z } from 'zod';

export const TransferItemSchema = z.object({
  itemNumber: z.number(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  additionalNotes: z.string().optional(),
  unit: z.string().default('EA'),
  quantity: z.number().default(1),
});
export type TransferItem = z.infer<typeof TransferItemSchema>;