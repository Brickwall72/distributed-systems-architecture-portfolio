// File: services/core/topology-service/shared/src/schemas/transfer-event.dto.schema.ts
import { z } from 'zod';

export const TransferEventAssetItemSchema = z.object({
  assetId: z.string(),
  assetNomenclature: z.string(),
  serialNumber: z.string(),
  invStatus: z.string(),
});

export type TransferEventAssetItemDTO = z.infer<typeof TransferEventAssetItemSchema>;

export const TransferEventDTOSchema = z.object({
  requisitionNumber: z.string(),
  date: z.string(),
  type: z.string(),
  status: z.string(),
  senderOrgId: z.string().optional(),
  senderName: z.string().optional(),
  receiverOrgId: z.string().optional(),
  receiverName: z.string().optional(),
  assets: z.array(TransferEventAssetItemSchema),
});

export type TransferEventDTO = z.infer<typeof TransferEventDTOSchema>;
export const TransferEventDTOListSchema = z.array(TransferEventDTOSchema);