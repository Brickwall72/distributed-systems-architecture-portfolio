// File: services/core/compliance-service/shared/src/schemas/API/templates.api.schema.ts
import { z } from 'zod';
import { formTypeEnum } from '../DTO';

/**
 * Shared HTTP GET /templates Query Parameters Schema
 */
export const GetTemplatesQuerySchema = z.object({
  type: formTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});

export type GetTemplatesQuery = z.infer<typeof GetTemplatesQuerySchema>;