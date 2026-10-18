// File: services/core/compliance-service/shared/src/contracts/templates.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema, StorageArtifactSchema } from '@contracts/common';
import { TemplateDTOSchema, GetTemplatesQuerySchema } from '../schemas';

const c = initContract();

export const TemplateManifestSchema = TemplateDTOSchema.omit({ rawHTML: true });
export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

export const TemplateDraftResponseSchema = StorageArtifactSchema.extend({
  presignedUrl: z.string().url(),
});

export type TemplateDraftResponse = z.infer<typeof TemplateDraftResponseSchema>;

export const templatesRoutes = {
  getTemplates: c.query({
    method: 'GET',
    path: '/templates',
    query: GetTemplatesQuerySchema,
    responses: {
      200: z.array(TemplateManifestSchema),
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve a lightweight manifest of available compliance templates.',
  }),
  getTemplate: c.query({
    method: 'GET',
    path: '/templates/:id',
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      200: TemplateDTOSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve the complete template DTO including raw HTML.',
  }),
  createTemplateDraft: c.mutation({
    method: 'POST',
    path: '/templates/:id/drafts',
    pathParams: z.object({ id: TemplateDTOSchema.shape.id }),
    body: z.record(z.unknown()),
    responses: {
      201: TemplateDraftResponseSchema,
      400: ApiErrorResponseSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Generate a compliance template draft PDF',
  }),
};

export const templatesContract = c.router(templatesRoutes);