// File: services/core/topology-service/client/src/hooks/useOrganizations/useOrganizations.ts
import { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import type { GetOrganizationsQuery, OrganizationDTOList } from 'topology-shared';

export function useOrganizations(params?: GetOrganizationsQuery) {
  const [items, setItems] = useState<OrganizationDTOList>([]);
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

        const response = await apiClient.getOrganizations({
          query: params,
          fetchOptions: { signal: controller.signal },
        });

        if (response.status === 200) {
          setItems(response.body);
        } else {
          // Align with ApiErrorResponseSchema ({ error: string, code: string, timestamp: string })
          const body = response.body as { error?: string; message?: string } | null | undefined;
          setError(body?.error || body?.message || 'Failed to fetch organizations');
          setItems([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        const message =
          err instanceof Error && err.message.trim() !== ''
            ? err.message
            : 'Failed to fetch organizations';

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