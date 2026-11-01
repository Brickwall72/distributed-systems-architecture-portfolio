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

/** Comma-separated status list (e.g. "IN_PROGRESS,PARTIALLY_COMPLETED") parsed into an array. */
export const GetDocumentsQuerySchema = z.object({
  status: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((val) => (val ? val.split(',').map((v) => v.trim()) : undefined))
    .pipe(z.array(DocumentStatusSchema).optional()),
  requisitionNumbers: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((val) => (val ? val.split(',').map((v) => v.trim()).filter(Boolean) : undefined)),
});
export type GetDocumentsQuery = z.input<typeof GetDocumentsQuerySchema>;

export const DocumentSchema = z.object({
  name: formIdEnum,
  type: formTypeEnum,
  transferType: transferTypeEnum,
  requisitionNumber: z.string(),
  transferEventId: z.string().nullable().optional(),
  status: DocumentStatusSchema,
  updatedAt: z.string().datetime(),
});

export type Document = z.infer<typeof DocumentSchema>;