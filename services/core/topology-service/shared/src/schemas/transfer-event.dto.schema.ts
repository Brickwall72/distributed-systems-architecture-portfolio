// File: services/core/topology-service/shared/src/schemas/transfer-event.dto.schema.ts
import { z } from 'zod';
import { BaseTransferSchema } from '@contracts/topology';
import { transferStatusEnum } from '@contracts/common';

export const TransferEventDTOSchema = BaseTransferSchema.extend({
  type: z.string(),
  status: transferStatusEnum,
  senderName: z.string().optional(),
  receiverName: z.string().optional(),
});

export type TransferEventDTO = z.infer<typeof TransferEventDTOSchema>;
export const TransferEventDTOListSchema = z.array(TransferEventDTOSchema);