// File: services/core/topology-service/client/src/hooks/useAssets.ts
import { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import type { GetAssetsQuery, AssetDTOList } from 'topology-shared';

export function useAssets(params?: GetAssetsQuery) {
  const [items, setItems] = useState<AssetDTOList>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize params into a primitive string key to compare by value, not object reference.
  const queryKey = JSON.stringify(params ?? {});

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        // Pass params directly to the contract call
        const response = await apiClient.getAssets({
          query: params,
          fetchOptions: { signal: controller.signal },
        });

        if (response.status === 200) {
          setItems(response.body);
        } else {
          // Align with ApiErrorResponseSchema ({ error: string, code: string, timestamp: string })
          const body = response.body as { error?: string; message?: string } | null | undefined;
          setError(body?.error || body?.message || 'Failed to fetch assets');
          setItems([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        
        const message =
          err instanceof Error && err.message.trim() !== ''
            ? err.message
            : 'Failed to fetch assets';

        setError(message);
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
  }, [queryKey]);

  return { items, isLoading, error };
}