// File: services/core/compliance-service/shared/src/schemas/templates/index.ts
import { z } from 'zod';

export const TemplateIdSchema = z.enum([
  'asset-transfer-authorization',
  'asset-transfer-receipt',
  'contract-test-bare',
]);

export type TemplateId = z.infer<typeof TemplateIdSchema>;
export * from './transfer';