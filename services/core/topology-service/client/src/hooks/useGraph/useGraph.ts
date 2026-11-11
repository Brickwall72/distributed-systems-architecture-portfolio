// File: services/core/topology-service/client/src/hooks/useGraph/useGraph.ts
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '@shared/ui-components';
import { apiClient } from '../../api';
import { NetworkCanvasInputSchema, type NetworkCanvasInputs } from '@contracts/topology';
import type { GraphDTO } from 'topology-shared';

export function useGraph(inputs?: NetworkCanvasInputs) {
  const identityId = useIdentity()?.id;
  const query = NetworkCanvasInputSchema.parse(inputs ?? {});
  const result = useQuery<GraphDTO, Error>({
    queryKey: ['topology-service', 'graph', identityId, query],
    enabled: Boolean(identityId),
    queryFn: async ({ signal }) => {
      const response = await apiClient.getGraph({
        query,
        fetchOptions: { signal },
      });

      if (response.status === 200 && response.body) {
        return response.body;
      }

      const body = response.body as { error?: string; message?: string } | null | undefined;
      throw new Error(body?.error || body?.message || 'Failed to fetch topology network graph');
    },
    retry: false,
  });

  return {
    graphData: result.data ?? null,
    isLoading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}