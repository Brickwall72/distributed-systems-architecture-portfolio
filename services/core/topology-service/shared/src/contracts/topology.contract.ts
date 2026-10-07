// File: services/core/topology-service/shared/src/contracts/topology.contract.ts
import { initContract } from '@ts-rest/core';
import { GetAssetsQuerySchema, AssetDTOListSchema } from '../schemas';
import { ApiErrorResponseSchema } from '@contracts/common'; // Your standard error schema

const c = initContract();

export const topologyContract = c.router({
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
  // Add more routes here later (e.g., getAssetById, createAsset)
});