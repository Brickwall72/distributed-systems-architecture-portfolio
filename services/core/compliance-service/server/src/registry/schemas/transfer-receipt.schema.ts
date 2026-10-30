// File: services/core/compliance-service/server/src/registry/schemas/transfer-receipt.schema.ts
import { TRANSFER_TYPE } from '@contracts/common';
import { FORM_TYPE, FORM_ID } from 'compliance-shared';
import { metadataSchema } from './metadata.schema';

export const transferReceiptMetadata = metadataSchema.parse({
  id: FORM_ID.ASSET_TRANSFER_RECEIPT,
  name: "Asset Transfer Receipt",
  fileName: "transfer-receipt.hbs",
  transferType: TRANSFER_TYPE.PHYSICAL_TRANSFER,
  type: FORM_TYPE.RECEIPT,
});