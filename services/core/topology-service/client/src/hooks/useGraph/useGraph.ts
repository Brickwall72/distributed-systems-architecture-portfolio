// File: services/core/topology-service/client/src/hooks/useGraph/useGraph.ts
import { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import type { GraphDTO } from 'topology-shared';

export function useGraph() {
  const [graphData, setGraphData] = useState<GraphDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.getGraph({
          query: undefined,
          fetchOptions: { signal: controller.signal },
        });

        if (response.status === 200 && response.body) {
          setGraphData(response.body);
        } else {
          const body = response.body as { error?: string; message?: string } | null | undefined;
          setError(body?.error || body?.message || 'Failed to fetch topology network graph');
          setGraphData(null);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        const message =
          err instanceof Error && err.message.trim() !== ''
            ? err.message
            : 'Failed to fetch topology network graph';

        setError(message);
        setGraphData(null);
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
  }, []);

  return { graphData, isLoading, error };
}