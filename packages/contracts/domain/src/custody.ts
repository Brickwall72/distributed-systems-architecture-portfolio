// File: packages/contracts/domain/src/custody.ts
import { z } from 'zod';

// 1. Graph Node Schemas (What Topology uses)
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

// 2. The Form Data Schema (What Compliance uses for the DD-1149)
export const DD1149TemplateDataSchema = z.object({
  fromEntityName: z.string(),
  fromAddressLine1: z.string().default(''),
  fromAddressLine2: z.string().default(''),
  toEntityName: z.string(),
  toAddressLine1: z.string().default(''),
  toAddressLine2: z.string().default(''),
  requisitionNumber: z.string(),
  transferDate: z.string(), // YYYYMMDD
  items: z.array(z.object({
    itemNumber: z.number(),
    nomenclature: z.string(),
    serialNumber: z.string(),
    additionalNotes: z.string().optional(),
    unit: z.string().default('EA'),
    quantity: z.number().default(1)
  })).min(1, "At least one asset is required for transfer"),
});
export type DD1149TemplateData = z.infer<typeof DD1149TemplateDataSchema>;