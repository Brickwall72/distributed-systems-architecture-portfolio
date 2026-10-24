// File: services/core/topology-service/shared/src/schemas/transfer-event.dto.schema.ts
import { z } from 'zod';
import { BaseTransferSchema } from '@contracts/topology';

export const TransferStatusEnum = z.enum(['IN_TRANSIT', 'PARTIALLY_COMPLETED', 'COMPLETED' ]);
export type TransferStatus = z.infer<typeof TransferStatusEnum>;

export const TransferEventDTOSchema = BaseTransferSchema.extend({
  type: z.string(),
  status: TransferStatusEnum,
  senderName: z.string().optional(),
  receiverName: z.string().optional(),
});

export type TransferEventDTO = z.infer<typeof TransferEventDTOSchema>;
export const TransferEventDTOListSchema = z.array(TransferEventDTOSchema);