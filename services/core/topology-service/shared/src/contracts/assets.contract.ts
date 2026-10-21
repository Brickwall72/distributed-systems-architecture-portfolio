// File: services/core/topology-service/shared/src/contracts/assets.contract.ts
import { initContract } from '@ts-rest/core';
import { AssetDTOListSchema, AssetDTOSchema, GetAssetsQuerySchema } from '@contracts/topology';
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
  createAsset: c.mutation({
    method: 'POST',
    path: '/assets',
    body: AssetDTOSchema,
    responses: {
      201: AssetDTOSchema,
      400: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Register a new asset and establish custody with an organization',
  }),
};

export const assetsContract = c.router(assetsRoutes);