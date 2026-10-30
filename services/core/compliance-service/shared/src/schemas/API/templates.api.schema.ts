// File: services/core/compliance-service/shared/src/schemas/API/templates.api.schema.ts
import { transferTypeEnum } from '@contracts/common';
import { formTypeEnum } from '../DTO';
import { z } from 'zod';

/**
 * Shared HTTP GET /templates Query Parameters Schema
 */
export const GetTemplatesQuerySchema = z.object({
  type: formTypeEnum.optional(),
  transferType: transferTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});

export type GetTemplatesQuery = z.infer<typeof GetTemplatesQuerySchema>;