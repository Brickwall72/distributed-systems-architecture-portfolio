// File: services/core/compliance-service/client/src/hooks/documents/useDocuments.ts
import { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { Document, DocumentSchema, DocumentStatus } from 'compliance-shared';
import { apiClient } from '../../api';

export interface UseDocumentsFilters {
  readonly statuses?: readonly DocumentStatus[];
  readonly requisitionNumbers?: readonly string[];
}

export function useDocuments({ statuses, requisitionNumbers }: UseDocumentsFilters = {}) {
  const statusQuery = statuses?.length ? statuses.join(',') : undefined;
  // undefined = unfiltered; an empty array means "match nothing" and skips the request.
  const matchesNothing = requisitionNumbers !== undefined && requisitionNumbers.length === 0;
  const requisitionQuery = requisitionNumbers?.length ? requisitionNumbers.join(',') : undefined;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (matchesNothing) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.getDocuments({ query: { status: statusQuery, requisitionNumbers: requisitionQuery } });

      if (response.status !== 200) {
        const errBody = response.body as { error?: string; message?: string };
        throw new Error(errBody?.error || errBody?.message || `Failed to fetch documents dataset: HTTP ${response.status}`);
      }

      // Enforces Zod contract validation at the boundary
      const parsedData = z.array(DocumentSchema).parse(response.body);
      setDocuments(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve dataset');
    } finally {
      setLoading(false);
    }
  }, [statusQuery, requisitionQuery, matchesNothing]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}