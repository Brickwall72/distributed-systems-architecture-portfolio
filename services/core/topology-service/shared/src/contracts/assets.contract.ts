// File: services/core/topology-service/shared/src/contracts/assets.contract.ts
import { initContract } from '@ts-rest/core';
import { GetAssetsQuerySchema } from '../schemas';
import { AssetDTOListSchema } from '@contracts/topology';
import { ApiErrorResponseSchema } from '@contracts/common';

const c = initContract();

export const assetsRoutes = {
  getAssets: c.query({
    method: 'GET',
    path: '/assets',
    query: GetAssetsQuerySchema,
    responses: {
      200: AssetDTOListSchema,
      400: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Fetch assets with optional owner filtering',
  }),
};

// Export individual sub-contract for server route instantiation
export const assetsContract = c.router(assetsRoutes);