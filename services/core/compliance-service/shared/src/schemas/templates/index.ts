// File: services/core/compliance-service/server/src/registry/schemas/index.ts
import z from 'zod';
import { FORM_ID } from '../DTO';
import { c2AuthTransferParserPipeline, c2AuthTransferAssetInputSchema, c2AuthTransferOrgInputSchema, c2AuthTransferInputSchema } from './C2-authority-transfer.schema';
import { transferAuthParserPipeline, transferAuthAssetInputSchema, transferAuthOrgInputSchema, transferAuthInputSchema } from './transfer-authorization.schema';
import { transferReceiptParserPipeline, transferReceiptAssetInputSchema, transferReceiptOrgInputSchema, transferReceiptInputSchema } from './transfer-receipt.schema';

const combinedAssetSchema = z.object({
  ...c2AuthTransferAssetInputSchema.shape,
  ...transferAuthAssetInputSchema.shape,
  ...transferReceiptAssetInputSchema.shape,
  id: z.string(),
});
const combinedOrgSchema = z.object({
  ...c2AuthTransferOrgInputSchema.shape,
  ...transferAuthOrgInputSchema.shape,
  ...transferReceiptOrgInputSchema.shape,
});
export const masterPayloadInputSchema = z.object({
  ...c2AuthTransferInputSchema.shape,
  ...transferAuthInputSchema.shape,
  ...transferReceiptInputSchema.shape,
  sourceOrg: combinedOrgSchema.optional(),
  targetOrg: combinedOrgSchema.optional(),
  assets: z.array(combinedAssetSchema).default([])
})

export const templateId2dataSchema = {
  [FORM_ID.ASSET_TRANSFER_AUTHORIZATION]: transferAuthParserPipeline,
  [FORM_ID.ASSET_TRANSFER_RECEIPT]: transferReceiptParserPipeline,
  [FORM_ID.AUTHORITY_TRANSFER_AUTHORIZATION]: c2AuthTransferParserPipeline,
}