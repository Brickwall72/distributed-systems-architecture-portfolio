// File: services/core/topology-service/shared/src/contracts/organizations.contract.ts
import { initContract } from '@ts-rest/core';
import { GetOrganizationsQuerySchema, OrganizationDTOListSchema } from '../schemas';
import { ApiErrorResponseSchema } from '@contracts/common';

const c = initContract();

export const organizationsRoutes = {
  getOrganizations: c.query({
    method: 'GET',
    path: '/organizations',
    query: GetOrganizationsQuerySchema,
    responses: {
      200: OrganizationDTOListSchema,
      400: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Fetch organizations with optional exclusion filtering',
  }),
};

// Export individual sub-contract for server route instantiation
export const organizationsContract = c.router(organizationsRoutes);