// File: services/core/topology-service/client/src/hooks/useAssets.ts
import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { GetAssetsQuery, AssetDTO } from 'topology-shared';

export function useAssets(params?: GetAssetsQuery) {
  const [items, setItems] = useState<AssetDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract primitive filter values for stable useEffect dependencies
  const filterOwnerId = params?.filterOwnerId;
  const excludeOwnerId = params?.excludeOwnerId;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.getAssets({
          query: { filterOwnerId, excludeOwnerId },
          fetchOptions: { signal: controller.signal },
        });

        if (response.status === 200) {
          setItems(response.body);
        } else {
          // Robust extract from ApiErrorResponseSchema or fallback string
          const responseError =
            typeof response.body === 'object' && response.body && 'error' in response.body
              ? String((response.body as { error: unknown }).error)
              : `Request failed with status ${response.status}`;

          setError(responseError);
          setItems([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        setError(err instanceof Error && err.message ? err.message : 'Failed to load assets');
        setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [filterOwnerId, excludeOwnerId]);

  return { items, isLoading, error };
}