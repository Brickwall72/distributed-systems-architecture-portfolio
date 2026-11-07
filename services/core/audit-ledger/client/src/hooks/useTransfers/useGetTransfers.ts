// File: service/core/audit-ledger/client/src/hooks/useTransfers/useGetTransfers.ts
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '@shared/ui-components';
import { apiClient } from '../../api';
import { GetTransfersQuery, TransferSummary } from 'audit-shared';

export function useGetTransfers(query?: GetTransfersQuery) {
  const identityId = useIdentity()?.id;

  return useQuery({
    queryKey: ['audit-ledger', 'transfers', identityId, query],
    enabled: Boolean(identityId),
    queryFn: async () => {
      const result = await apiClient.getTransfers({ query });

      if (result.status !== 200) {
        const errBody = result.body as { error?: string; message?: string };
        throw new Error(errBody?.error || errBody?.message || `Failed to fetch transfers: HTTP ${result.status}`);
      }

      return result.body as TransferSummary[];
    },
    staleTime: 0,          // Data is immediately stale upon mounting
    refetchOnMount: true,  // Trigger a background refetch whenever the component mounts
  });
}