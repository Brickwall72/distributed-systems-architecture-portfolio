// File: services/core/topology-service/client/src/hooks/useAssets/useAssets.ts
import { apiClient } from '../../api';
import { useTopologyQuery } from '../useTopologyQuery';
import type { GetAssetsQuery, AssetDTO } from 'topology-shared';

export function useAssets(params?: GetAssetsQuery) {
  return useTopologyQuery<GetAssetsQuery, AssetDTO>({
    params,
    fetcher: (queryParams, options) =>
      apiClient.getAssets({
        query: queryParams,
        fetchOptions: options,
      }),
    fallbackErrorMessage: 'Failed to fetch assets',
  });
}