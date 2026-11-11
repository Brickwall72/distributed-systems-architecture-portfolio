// File: packages/contracts/topology/src/inputs/NetworkCanvas.input.schema.ts
import { z } from 'zod';

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
