// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.ts
import { apiClient } from '../../api/client';
import { useTopologyQuery } from '../useTopologyQuery';
import type { GetOrganizationsQuery, OrganizationDTO } from 'topology-shared';

export function useOrganizations(params?: GetOrganizationsQuery) {
  return useTopologyQuery<GetOrganizationsQuery, OrganizationDTO>({
    params,
    fetcher: (queryParams, options) =>
      apiClient.getOrganizations({
        query: queryParams,
        fetchOptions: options,
      }),
    fallbackErrorMessage: 'Failed to fetch organizations',
  });
}