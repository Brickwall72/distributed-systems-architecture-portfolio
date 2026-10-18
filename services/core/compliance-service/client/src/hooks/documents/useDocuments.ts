// File: services/core/compliance-service/client/src/hooks/documents/useDocuments.ts
import { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { Document, DocumentSchema } from 'compliance-shared';
import { apiClient } from '../../api';

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getDocuments();

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
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}