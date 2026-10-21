// File: services/core/topology-service/shared/src/contracts/outputs/graph.dto.schema.ts
import { z } from 'zod';
import { OrganizationDTOSchema, AssetDTOSchema } from '@contracts/topology';
import { TransferEventDTOSchema } from './transfer-event.dto.schema';

export const CustodyLinkDTOSchema = z.object({
  orgId: z.string(),
  assetId: z.string(),
});

export const GraphDTOSchema = z.object({
  timestamp: z.string(),
  organizations: z.array(OrganizationDTOSchema),
  assets: z.array(AssetDTOSchema),
  activeTransfers: z.array(TransferEventDTOSchema),
  custodyLinks: z.array(CustodyLinkDTOSchema),
});

export type GraphDTO = z.infer<typeof GraphDTOSchema>;