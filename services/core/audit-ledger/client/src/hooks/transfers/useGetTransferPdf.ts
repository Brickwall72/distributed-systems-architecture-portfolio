// File: service/core/audit-ledger/client/src/hooks/useTransfers/useGetTransferPdf.ts
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '@shared/ui-components';
import { apiClient } from '../../api';

export function useGetTransferPdf(requisitionNumber?: string) {
  const identityId = useIdentity()?.id;
  return useQuery({
    queryKey: ['audit-ledger', 'transfer-pdf', identityId, requisitionNumber],
    enabled: Boolean(identityId && requisitionNumber),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!identityId || !requisitionNumber) throw new Error('A profile and transfer must be selected.');
      const response = await apiClient.getTransferDocument({
        params: { requisitionNumber },
        fetchOptions: { signal },
      });
      if (response.status !== 200) throw new Error(`Failed to get transfer document URL (HTTP ${response.status})`);
      const pdf = await fetch(response.body.presignedUrl, { signal });
      if (!pdf.ok) throw new Error(`Failed to download PDF (HTTP ${pdf.status})`);
      const contentType = pdf.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/pdf') throw new Error(`Expected a PDF, received ${contentType || 'unknown content type'}`);
      return pdf.blob();
    },
  });
}
