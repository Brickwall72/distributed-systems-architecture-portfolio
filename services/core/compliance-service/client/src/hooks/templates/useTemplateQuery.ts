// File: services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts
import { apiClient } from '../../api';
import { useComplianceQuery } from '../useComplianceQuery';
import { TemplateDTO, FormId } from 'compliance-shared';

// Full templates (rawHTML) are immutable per id, so successful fetches are reused for the session.
const templateCache = new Map<FormId, TemplateDTO>();

export function clearTemplateCache() {
  templateCache.clear();
}

export function useTemplateQuery(id?: FormId) {
  return useComplianceQuery<FormId | undefined, TemplateDTO>({
    params: id,
    enabled: id !== undefined,
    fetcher: async (queryParams, options) => {
      if (!queryParams) {
        throw new Error('Template ID is required');
      }
      const cached = templateCache.get(queryParams);
      if (cached) {
        return { status: 200, body: cached };
      }
      const response = await apiClient.getTemplate({
        params: { id: queryParams },
        fetchOptions: options,
      });
      if (response.status === 200) {
        templateCache.set(queryParams, response.body as TemplateDTO);
      }
      return response;
    },
    fallbackErrorMessage: 'Failed to fetch template content',
  });
}