// File: services/core/compliance-service/client/src/hooks/useGetPdf.ts
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '@shared/ui-components';
import { apiClient } from '../../api';

export function useGetPdf(docId?: string) {
  const identityId = useIdentity()?.id;

  return useQuery({
    queryKey: ['compliance-service', 'get-pdf', identityId, docId],
    enabled: Boolean(identityId && docId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,

    queryFn: async ({ signal }) => {
      // Also protects against a manual refetch while the query is disabled.
      if (!identityId || !docId) {
        throw new Error('A profile and document must be selected.');
      }

      const response = await apiClient.getDocumentContentById({
        params: { id: docId },
        fetchOptions: { signal },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get document URL (HTTP ${response.status})`);
      }

      const pdfRes = await fetch(response.body.presignedUrl, { signal });
      if (!pdfRes.ok) {
        throw new Error(`Failed to download PDF (HTTP ${pdfRes.status})`);
      }

      const contentType = pdfRes.headers.get('content-type')
        ?.split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/pdf') {
        throw new Error(`Expected a PDF, received ${contentType || 'unknown content type'}`);
      }

      return pdfRes.blob();
    },
  });
}