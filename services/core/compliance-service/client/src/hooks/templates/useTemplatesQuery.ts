// File: services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.ts
import { apiClient } from '../../api/client';
import { useComplianceQuery } from '../useComplianceQuery';
import type { GetTemplatesQuery, TemplateManifest } from 'compliance-shared';

export function useTemplatesQuery(params?: GetTemplatesQuery) {
  const result = useComplianceQuery<GetTemplatesQuery, TemplateManifest[]>({
    params,
    fetcher: (queryParams, options) =>
      apiClient.getTemplates({
        query: queryParams,
        fetchOptions: options,
      }),
    fallbackErrorMessage: 'Failed to fetch compliance template manifests',
  });

  // Guarantee an empty array fallback so components never receive null
  return {
    ...result,
    data: result.data ?? [],
  };
}