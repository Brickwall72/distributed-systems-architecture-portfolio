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

// Shared Item Schema for all transfer documents
export const TransferItemSchema = z.object({
  itemNumber: z.number(),
  nomenclature: z.string(),
  serialNumber: z.string(),
  additionalNotes: z.string().optional(),
  unit: z.string().default('EA'),
  quantity: z.number().default(1),
});
export type TransferItem = z.infer<typeof TransferItemSchema>;

// 2. The Form Data Schema (What Compliance uses for the DD-1149)
export const DD1149TemplateDataSchema = z.object({
  releasingEntityName: z.string(),
  releasingAddressLine1: z.string().default(''),
  releasingAddressLine2: z.string().default(''),
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string().default(''),
  receivingAddressLine2: z.string().default(''),
  requisitionNumber: z.string(),
  transferDate: z.string(), // YYYYMMDD
  items: z.array(TransferItemSchema).min(1, "At least one asset is required for transfer"),
});
export type DD1149TemplateData = z.infer<typeof DD1149TemplateDataSchema>;

// 3. The Form Data Schema (What Compliance uses for the Initiating Document)
export const TransferAuthorizationTemplateDataSchema = z.object({
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string().default(''),
  receivingAddressLine2: z.string().default(''),
  releasingEntityName: z.string(),
  releasingAddressLine1: z.string().default(''),
  releasingAddressLine2: z.string().default(''),
  authorizationCode: z.string(), 
  authorizationDate: z.string(), // YYYYMMDD
  items: z.array(TransferItemSchema).min(1, "At least one asset is required for transfer"),
});
export type TransferAuthorizationTemplateData = z.infer<typeof TransferAuthorizationTemplateDataSchema>;