// File: packages/contract/common/src/transfers.schema.ts
import { z } from 'zod';

export const transferTypeEnum = z.enum(['PHYSICAL_TRANSFER', 'C2_TRANSFER']);

export type TransferType = z.infer<typeof transferTypeEnum>;