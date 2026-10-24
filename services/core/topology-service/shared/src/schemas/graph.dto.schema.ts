// File: services/core/topology-service/shared/src/contracts/outputs/graph.dto.schema.ts
import { z } from 'zod';
import { OrganizationDTOListSchema, AssetDTOListSchema } from '@contracts/topology';
import { TransferEventDTOListSchema } from './transfer-event.dto.schema';

export const CustodyLinkDTOSchema = z.object({
  orgId: z.string(),
  assetId: z.string(),
});

export const GraphDTOSchema = z.object({
  timestamp: z.string(),
  organizations: OrganizationDTOListSchema,
  assets: AssetDTOListSchema,
  activeTransfers: TransferEventDTOListSchema,
  custodyLinks: z.array(CustodyLinkDTOSchema),
});

export type GraphDTO = z.infer<typeof GraphDTOSchema>;