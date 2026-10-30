// File: services/core/compliance-service/server/src/registry/schemas/C2-authority-transfer.schema.ts
import { TRANSFER_TYPE } from '@contracts/common';
import { FORM_TYPE, FORM_ID } from 'compliance-shared';
import { metadataSchema } from './metadata.schema';

export const c2AuthTransferMetadata = metadataSchema.parse({
  id: FORM_ID.AUTHORITY_TRANSFER_AUTHORIZATION,
  name: "C2 Authority Transfer Authorization",
  fileName: "C2-authority-transfer.hbs",
  transferType: TRANSFER_TYPE.C2_TRANSFER,
  type: FORM_TYPE.AUTHORIZATION,
});