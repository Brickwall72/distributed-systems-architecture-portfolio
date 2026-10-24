// File: packages/contracts/topology/src/outputs/transfer-event.dto.schema.ts
import { z } from 'zod';
import { AssetItemDTOListSchema } from './asset.dto.schema';

export const BaseTransferSchema = z.object({
  requisitionNumber: z.string().min(1),
  date: z.string(),
  senderOrgId: z.string(),
  receiverOrgId: z.string(),
  assets: AssetItemDTOListSchema,
});