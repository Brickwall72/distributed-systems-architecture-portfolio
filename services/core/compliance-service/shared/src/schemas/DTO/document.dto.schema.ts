// File: services/core/compliance-service/shared/src/schemas/DTO/document.dto.schema.ts
import { z } from 'zod';
import { StorageArtifactSchema } from '@contracts/common';
import { TemplateIdSchema } from './template.dto.schema';

export const DocumentStatusSchema = z.enum([
  'PENDING_SIGNATURE',
  'SIGNED',
  'REJECTED',
  'SUPERSEDED',
]);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentSchema = StorageArtifactSchema.extend({
  documentType: TemplateIdSchema,
  status: DocumentStatusSchema,
  signerId: z.string().optional(),
  entityId: z.string().optional(),
  transferEventId: z.string().uuid().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;