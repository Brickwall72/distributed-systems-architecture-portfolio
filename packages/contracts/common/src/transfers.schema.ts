// File: packages/contract/common/src/transfers.schema.ts
import { z } from 'zod';

export const TRANSFER_TYPE = {
  PHYSICAL_TRANSFER: 'PHYSICAL_TRANSFER',
  C2_TRANSFER: 'C2_TRANSFER',
} as const;
export const transferTypeEnum = z.enum(
  Object.values(TRANSFER_TYPE) as [typeof TRANSFER_TYPE[keyof typeof TRANSFER_TYPE], ...typeof TRANSFER_TYPE[keyof typeof TRANSFER_TYPE][]]
);
export type TransferType = z.infer<typeof transferTypeEnum>;

export const TRANSFER_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  COMPLETED: 'COMPLETED',
} as const;
export const transferStatusEnum = z.enum(
  Object.values(TRANSFER_STATUS) as [typeof TRANSFER_STATUS[keyof typeof TRANSFER_STATUS], ...typeof TRANSFER_STATUS[keyof typeof TRANSFER_STATUS][]]
);
export type TransferStatus = z.infer<typeof transferStatusEnum>;