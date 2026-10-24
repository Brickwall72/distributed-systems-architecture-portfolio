// File: services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts
import { apiClient } from '../../api';
import { useComplianceQuery } from '../useComplianceQuery';
import type { TemplateDTO, FormName } from 'compliance-shared';

export function useTemplateQuery(id?: FormName) {
  return useComplianceQuery<FormName | undefined, TemplateDTO>({
    params: id,
    fetcher: (queryParams, options) => {
      // Guard against undefined so we don't accidentally fire requests with empty IDs
      if (!queryParams) {
        throw new Error('Template ID is required'); // Or handle gracefully
      }
      return apiClient.getTemplate({
        params: { id: queryParams },
        fetchOptions: options,
      });
    },
    fallbackErrorMessage: 'Failed to fetch template content',
  });
}