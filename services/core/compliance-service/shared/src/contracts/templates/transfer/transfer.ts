// File: services/core/compliance-service/shared/src/contracts/templates/transfer/transfer.ts
import { z } from 'zod';

export const TransferItemSchema = z.object({
  itemNumber: z.union([z.number(), z.string()]),
  nomenclature: z.string(),
  serialNumber: z.string(),
  additionalNotes: z.string().optional(),
  unit: z.string().default('EA'),
  quantity: z.number().int().positive(),
});

export const TransferPayloadSchema = z.object({
  releasingEntityName: z.string(),
  releasingAddressLine1: z.string(),
  releasingAddressLine2: z.string(),
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string(),
  receivingAddressLine2: z.string(),
  requisitionNumber: z.string(),
  transferDate: z.string().regex(/^\d{8}$/, 'Date must be formatted as YYYYMMDD'),
  items: z.array(TransferItemSchema).min(1),
});

export type TransferPayload = z.infer<typeof TransferPayloadSchema>;