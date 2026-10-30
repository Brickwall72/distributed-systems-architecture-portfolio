// File: services/core/compliance-service/shared/src/contracts/templates.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema, transferTypeEnum } from '@contracts/common';
import { SignDocumentCommandSchema } from '@contracts/esign';
import { templateDTOSchema, GetTemplatesQuerySchema, formTypeEnum, templateManifestListSchema } from '../schemas';

const c = initContract();

export const TemplateDraftResponseSchema = SignDocumentCommandSchema.omit({
  customPath: true, signatureImageBase64: true, signerId: true
}).extend({
  presignedUrl: z.string().url(),
  requisitionNumber: z.string(),
  documentType: formTypeEnum,
  transferType: transferTypeEnum,
});

export type TemplateDraftResponse = z.infer<typeof TemplateDraftResponseSchema>;

export const templatesRoutes = {
  getTemplates: c.query({
    method: 'GET',
    path: '/templates',
    query: GetTemplatesQuerySchema,
    responses: {
      200: templateManifestListSchema,
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
      200: templateDTOSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve the complete template DTO including raw HTML.',
  }),
  createTemplateDraft: c.mutation({
    method: 'POST',
    path: '/templates/:id/drafts',
    pathParams: z.object({ id: templateDTOSchema.shape.id }),
    body: z.object({
      data: z.record(z.unknown()),
    }),
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