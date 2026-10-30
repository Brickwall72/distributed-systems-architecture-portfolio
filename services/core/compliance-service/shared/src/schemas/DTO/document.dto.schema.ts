// File: services/core/compliance-service/shared/src/schemas/DTO/document.dto.schema.ts
import { z } from 'zod';
import { transferTypeEnum } from '@contracts/common';
import { formIdEnum, formTypeEnum } from './template.dto.schema';

export const DocumentStatusSchema = z.enum([
  'SIGNED',
  'IN_PROGRESS',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
]);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentSchema = z.object({
  name: formIdEnum,
  type: formTypeEnum,
  transferType: transferTypeEnum,
  requisitionNumber: z.string(),
  status: DocumentStatusSchema,
  updatedAt: z.string().datetime(),
});

export type Document = z.infer<typeof DocumentSchema>;