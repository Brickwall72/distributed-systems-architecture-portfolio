// File: services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.ts
import { apiClient } from '../../api';
import { useTopologyQuery } from '../useTopologyQuery';
import { AssetDTO, GetAssetsQuery } from '@contracts/topology';

export function useGetAssets(params?: GetAssetsQuery) {
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