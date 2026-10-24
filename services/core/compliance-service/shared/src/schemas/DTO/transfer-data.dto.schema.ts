// File: services/core/compliance-service/shared/src/schemas/DTO/transfer-data.dto.schema.ts
import { z } from 'zod';
import { StorageArtifactSchema, transferTypeEnum } from '@contracts/common';
import { BaseTransferSchema } from '@contracts/topology';

export const ComplianceStorageArtifactSchema = StorageArtifactSchema.extend({
  ...BaseTransferSchema.shape,
  documentType: transferTypeEnum,
});

export type ComplianceStorageArtifact = z.infer<typeof ComplianceStorageArtifactSchema>;