// File: services/core/compliance-service/server/src/registry/schemas/transfer-authorization.schema.ts
import { TRANSFER_TYPE } from '@contracts/common';
import { FORM_TYPE, FORM_ID } from 'compliance-shared';
import { metadataSchema } from './metadata.schema';

export const transferAuthMetadata = metadataSchema.parse({
  id: FORM_ID.ASSET_TRANSFER_AUTHORIZATION,
  name: "Asset Transfer Authorization",
  fileName: "transfer-authorization.hbs",
  transferType: TRANSFER_TYPE.PHYSICAL_TRANSFER,
  type: FORM_TYPE.AUTHORIZATION,
});