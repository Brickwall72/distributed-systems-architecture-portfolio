// File: services/core/topology-service/client/src/hooks/useAssets.ts
import { useEffect, useState } from 'react';
import { Asset } from '@contracts/custody';
import { fetchAssets, GetAssetsParams } from '../../api';

export function useAssets(params?: GetAssetsParams) {
  const [items, setItems] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchAssets(params);
        if (isMounted) setItems(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load assets');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => { isMounted = false; };
  }, [params?.ownerId, params?.excludeOwnerId]);

  return { items, isLoading, error };
}