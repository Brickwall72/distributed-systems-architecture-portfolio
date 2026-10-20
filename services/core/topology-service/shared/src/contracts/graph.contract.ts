// File: services/core/topology-service/shared/src/contracts/graph.contract.ts
import { initContract } from '@ts-rest/core';
import { GraphDTOSchema } from '../schemas';
import { ApiErrorResponseSchema } from '@contracts/common';
import { z } from 'zod';

const c = initContract();

export const graphRoutes = {
  getGraph: c.query({
    method: 'GET',
    path: '/graph',
    query: z.object({}).optional(),
    responses: {
      200: GraphDTOSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Fetch full topology network graph projection for NetworkCanvasWidget',
  }),
};

export const graphContract = c.router(graphRoutes);