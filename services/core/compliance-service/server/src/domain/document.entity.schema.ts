// File: services/core/compliance-service/server/src/domain/document.entity.ts
import { formNameEnum, formTypeEnum } from 'compliance-shared';
import { transferTypeEnum } from '@contracts/common';
import { insertDataSchema } from '../repositories';
import { z } from 'zod';

export const documentEntitySchema = insertDataSchema.omit({
  documentId: true, documentName: true, documentType: true,
}).extend({
  id: z.string().uuid(),
  name: formNameEnum,
  type: formTypeEnum,
  transferType: transferTypeEnum,
  transferEventId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DocumentEntity = z.infer<typeof documentEntitySchema>;