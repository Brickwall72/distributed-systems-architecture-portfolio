// File: packages/contracts/topology/src/inputs/NetworkCanvas.input.schema.ts
import { z } from 'zod';

export const TOPOLOGY_GRAPH_QUERY_KEY = ['topology-service', 'graph'] as const;

const idList = z.array(z.string().trim().min(1)).default([]);
const booleanFromQuery = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]).default(false);

export const NetworkCanvasInputSchema = z.object({
  whitelistSenders: idList,
  whitelistReceivers: idList,
  whitelistAssets: idList,
  whitelistTransfers: idList,
  includeCompletedTransferEvents: booleanFromQuery,
});

export type NetworkCanvasInputs = z.input<typeof NetworkCanvasInputSchema>;
export type NetworkCanvasInput = z.output<typeof NetworkCanvasInputSchema>;

/** Widget-only options; selection overlays asset history without changing graph query defaults. */
export const NetworkCanvasWidgetInputSchema = NetworkCanvasInputSchema.extend({
  enableAssetHistorySelection: z.boolean().default(false),
});

export type NetworkCanvasProps = z.input<typeof NetworkCanvasWidgetInputSchema>;
