// File: packages/contracts/compliance/src/templates.ts
import { z } from 'zod';
import { TransferItemSchema } from '@contracts/common';

export const DD1149TemplateDataSchema = z.object({
  releasingEntityName: z.string(),
  releasingAddressLine1: z.string().default(''),
  releasingAddressLine2: z.string().default(''),
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string().default(''),
  receivingAddressLine2: z.string().default(''),
  requisitionNumber: z.string(),
  transferDate: z.string(), // YYYYMMDD
  items: z.array(TransferItemSchema).min(1, 'At least one asset is required for transfer'),
});
export type DD1149TemplateData = z.infer<typeof DD1149TemplateDataSchema>;

export const TransferAuthorizationTemplateDataSchema = z.object({
  receivingEntityName: z.string(),
  receivingAddressLine1: z.string().default(''),
  receivingAddressLine2: z.string().default(''),
  releasingEntityName: z.string(),
  releasingAddressLine1: z.string().default(''),
  releasingAddressLine2: z.string().default(''),
  authorizationCode: z.string(),
  authorizationDate: z.string(), // YYYYMMDD
  items: z.array(TransferItemSchema).min(1, 'At least one asset is required for transfer'),
});
export type TransferAuthorizationTemplateData = z.infer<typeof TransferAuthorizationTemplateDataSchema>;