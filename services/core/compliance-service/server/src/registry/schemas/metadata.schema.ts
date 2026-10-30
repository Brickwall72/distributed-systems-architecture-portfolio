// File: services/core/compliance-service/server/src/registry/schemas/metadata.schema.ts
import { templateDTOSchema } from 'compliance-shared';
import z from 'zod';

export const metadataSchema = templateDTOSchema.omit({rawHTML: true}).extend({
  fileName: z.string(),
});