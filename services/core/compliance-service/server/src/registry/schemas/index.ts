// File: services/core/compliance-service/server/src/registry/schemas/index.ts
import { c2AuthTransferMetadata } from './C2-authority-transfer.schema';
import { transferAuthMetadata } from './transfer-authorization.schema';
import { transferReceiptMetadata } from './transfer-receipt.schema';

export const masterTemplateRegistry = {
  [c2AuthTransferMetadata.id]: c2AuthTransferMetadata,
  [transferAuthMetadata.id]: transferAuthMetadata,
  [transferReceiptMetadata.id]: transferReceiptMetadata,
} as const;

// Convenient array export for iteration, manifests, and zocker coverage tests
export const templatesArray = Object.values(masterTemplateRegistry);

export type MasterTemplateRegistry = typeof masterTemplateRegistry;