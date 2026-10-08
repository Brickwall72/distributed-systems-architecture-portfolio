// File: services/core/topology-service/client/src/hooks/useTopologyQuery.ts
import { useEffect, useRef, useState } from 'react';

interface FetcherOptions {
  signal: AbortSignal;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface UseTopologyQueryOptions<TParams> {
  params?: TParams;
  fetcher: (params: TParams | undefined, options: FetcherOptions) => Promise<ApiResponse>;
  fallbackErrorMessage: string;
}

export function useTopologyQuery<TParams, TData>({
  params,
  fetcher,
  fallbackErrorMessage,
}: UseTopologyQueryOptions<TParams>) {
  const [items, setItems] = useState<TData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep latest fetcher AND params in refs to avoid closure staleness without breaking dependency checks
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Primitive string key comparison prevents infinite render loops from un-memoized object params
  const queryKey = JSON.stringify(params ?? {});

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        // Access parameters safely via the ref
        const response = await fetcherRef.current(paramsRef.current, { signal: controller.signal });

        if (response.status === 200 && Array.isArray(response.body)) {
          setItems(response.body as TData[]);
        } else {
          const body = response.body as { error?: string; message?: string } | null | undefined;
          setError(body?.error || body?.message || fallbackErrorMessage);
          setItems([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        const message =
          err instanceof Error && err.message.trim() !== ''
            ? err.message
            : fallbackErrorMessage;

        setError(message);
        setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  // 🚨 REMOVED `params` from dependencies! `queryKey` controls execution lifecycle.
  }, [queryKey, fallbackErrorMessage]); 

  return { items, isLoading, error };
}