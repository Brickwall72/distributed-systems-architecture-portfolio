// File: services/core/compliance-service/client/src/hooks/documents/useDocuments.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { useIdentity } from '@shared/ui-components';
import { z } from 'zod';
import { Document, DocumentSchema, DocumentStatus } from 'compliance-shared';
import { apiClient } from '../../api';

export interface UseDocumentsFilters {
  readonly statuses?: readonly DocumentStatus[];
  readonly requisitionNumbers?: readonly string[];
}

export function useDocuments({ statuses, requisitionNumbers }: UseDocumentsFilters = {}) {
  const identityId = useIdentity()?.id;
  const statusQuery = statuses?.length ? statuses.join(',') : undefined;
  const matchesNothing = requisitionNumbers?.length === 0;
  const requisitionQuery = requisitionNumbers?.length ? requisitionNumbers.join(',') : undefined;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsIdentityId, setDocumentsIdentityId] = useState<string>();
  const [loading, setLoading] = useState<boolean>(Boolean(identityId));
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchDocuments = useCallback(async (background = false) => {
    if (background && controllerRef.current) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!background) setLoading(true);
    setError(null);
    if (matchesNothing || !identityId) {
      setDocuments([]);
      setDocumentsIdentityId(undefined);
      setLoading(false);
      controllerRef.current = null;
      return;
    }
    try {
      const response = await apiClient.getDocuments({
        query: { status: statusQuery, requisitionNumbers: requisitionQuery },
        fetchOptions: { signal: controller.signal },
      });

      if (controller.signal.aborted) return;

      if (response.status !== 200) {
        const errBody = response.body as { error?: string; message?: string };
        throw new Error(errBody?.error || errBody?.message || `Failed to fetch documents dataset: HTTP ${response.status}`);
      }

      // Enforces Zod contract validation at the boundary
      const parsedData = z.array(DocumentSchema).parse(response.body);
      setDocuments(parsedData);
      setDocumentsIdentityId(identityId);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to retrieve dataset');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (!background) setLoading(false);
      }
    }
  }, [statusQuery, requisitionQuery, matchesNothing, identityId]);

  useEffect(() => {
    void fetchDocuments();
    return () => controllerRef.current?.abort();
  }, [fetchDocuments]);

  const hasUnresolved = documentsIdentityId === identityId
    && documents.some((document) => document.topologyApplicationStatus !== 'APPLIED');
  useEffect(() => {
    if (!hasUnresolved) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      timer = setTimeout(() => {
        void fetchDocuments(true).finally(() => { if (active) refresh(); });
      }, 5000);
    };
    refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [fetchDocuments, hasUnresolved]);

  return {
    documents: identityId && documentsIdentityId === identityId ? documents : [],
    loading,
    error,
    refetch: fetchDocuments,
  };
}