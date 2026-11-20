// File: services/core/topology-service/client/src/hooks/useGetOrganizations/useGetOrganizations.ts
import { apiClient } from '../../api';
import { useTopologyQuery } from '../useTopologyQuery';
import { OrganizationDTO, GetOrganizationsQuery } from '@contracts/topology';

export function useGetOrganizations(params?: GetOrganizationsQuery, refreshKey?: number) {
  return useTopologyQuery<GetOrganizationsQuery, OrganizationDTO>({
    params,
    refreshKey,
    fetcher: (queryParams, options) =>
      apiClient.getOrganizations({
        query: queryParams,
        fetchOptions: options,
      }),
    fallbackErrorMessage: 'Failed to fetch organizations',
  });
}