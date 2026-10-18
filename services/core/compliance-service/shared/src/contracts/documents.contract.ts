// File: services/core/compliance-service/shared/src/contracts/documents.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema } from '@contracts/common';
import { DocumentSchema } from '../schemas';

const c = initContract();

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
};

export const documentsContract = c.router(documentsRoutes);