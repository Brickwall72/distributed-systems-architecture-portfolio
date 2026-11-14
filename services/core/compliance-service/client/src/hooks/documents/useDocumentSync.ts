// File: services/core/compliance-service/client/src/hooks/documents/useDocumentSync.ts
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '@shared/ui-components';
import { DocumentSchema, Document } from 'compliance-shared';
import { apiClient } from '../../api';

export function useDocumentSync(documentId?: string) {
  const identityId = useIdentity()?.id;
  return useQuery({
    queryKey: ['compliance-service', 'document-sync', identityId, documentId],
    enabled: Boolean(identityId && documentId),
    refetchInterval: (query) => (query.state.data as Document | undefined)?.topologyApplicationStatus === 'APPLIED' ? false : 5000,
    queryFn: async ({ signal }) => {
      if (!identityId || !documentId) throw new Error('A profile and document must be selected.');
      const response = await apiClient.getDocumentById({
        params: { id: documentId },
        fetchOptions: { signal },
      });
      if (response.status !== 200) throw new Error(`Failed to check document synchronization (HTTP ${response.status})`);
      return DocumentSchema.parse(response.body);
    },
  });
}
