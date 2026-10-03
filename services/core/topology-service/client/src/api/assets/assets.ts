// File: services/core/topology-service/client/src/api/assets/assets.ts
import { Asset } from '@contracts/custody';

export interface GetAssetsParams {
  ownerId?: string;
  excludeOwnerId?: string;
}

export async function fetchAssets(params?: GetAssetsParams): Promise<Asset[]> {
  const searchParams = new URLSearchParams();
  if (params?.ownerId) searchParams.append('ownerId', params.ownerId);
  if (params?.excludeOwnerId) searchParams.append('excludeOwnerId', params.excludeOwnerId);

  const queryString = searchParams.toString();
  const url = queryString ? `/topology/api/v1/assets?${queryString}` : '/topology/api/v1/assets';

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch assets (${response.status})`);
  }

  return response.json();
}