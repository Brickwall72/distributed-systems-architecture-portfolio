// File: services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts
import { apiClient } from '../../api/client';
import { useComplianceQuery } from '../useComplianceQuery';
import type { TemplateDTO } from 'compliance-shared';

interface TemplateParams {
  id: string;
}

export function useTemplateQuery(id?: string) {
  return useComplianceQuery<TemplateParams, TemplateDTO>({
    params: id ? { id } : undefined,
    fetcher: (queryParams, options) =>
      apiClient.getTemplate({
        params: { id: queryParams!.id },
        fetchOptions: options,
      }),
    fallbackErrorMessage: 'Failed to fetch template content',
  });
}