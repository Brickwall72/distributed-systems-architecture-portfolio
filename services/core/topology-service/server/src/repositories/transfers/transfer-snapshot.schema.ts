// File: services/core/topology-service/server/src/repositories/transfers/transfer-snapshot.schema.ts
import { transferStatusEnum, transferTypeEnum } from '@contracts/common';
import { transferAssetSnapshotSchema, transferOrganizationSnapshotSchema } from '@contracts/topology';
import { z } from 'zod';

export const transferEventSnapshotSchema = z.object({
  id: z.string().uuid(),
  requisitionNumber: z.string(),
  type: transferTypeEnum,
  date: z.string().datetime(),
  status: transferStatusEnum,
  sender: transferOrganizationSnapshotSchema,
  receiver: transferOrganizationSnapshotSchema,
  assets: z.array(transferAssetSnapshotSchema).min(1),
});
