// File: services/core/compliance-service/shared/src/contracts/documents.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema } from '@contracts/common';
import { SignDocumentCommandSchema } from '@contracts/esign';
import { transferInitiatedDataSchema } from '@contracts/compliance';
import { DocumentSchema, formNameEnum, formTypeEnum  } from '../schemas';

const c = initContract();

export const signDocumentApiRequestSchema = SignDocumentCommandSchema.extend({
  ...transferInitiatedDataSchema.omit({date: true}).shape,
  documentName: formNameEnum,
  documentType:formTypeEnum
});

export const documentsRoutes = {
  getDocuments: c.query({
    method: 'GET',
    path: '/documents',
    responses: {
      200: z.array(DocumentSchema),
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve all document records.',
  }),
  getDocumentById: c.query({
    method: 'GET',
    path: '/documents/:id',
    pathParams: z.object({
      id: z.string().uuid(),
    }),
    responses: {
      200: DocumentSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve a single document by UUID.',
  }),
  signDocument: c.mutation({
    method: 'POST',
    path: '/documents/sign',
    body: signDocumentApiRequestSchema,
    responses: {
      200: z.object({ presignedUrl: z.string() }),
      400: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Sign a compliance document via NATS request-response to esign-service.',
  }),
};

export const documentsContract = c.router(documentsRoutes);