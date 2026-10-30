// File: services/core/compliance-service/client/src/hooks/useComplianceQuery.ts
import { useEffect, useRef, useState } from 'react';

interface FetcherOptions {
  signal: AbortSignal;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface UseComplianceQueryOptions<TParams> {
  params?: TParams;
  fetcher: (params: TParams | undefined, options: FetcherOptions) => Promise<ApiResponse>;
  fallbackErrorMessage: string;
  /** When false, no request is made and state resets to idle. Defaults to true. */
  enabled?: boolean;
}

export function useComplianceQuery<TParams, TData>({
  params,
  fetcher,
  fallbackErrorMessage,
  enabled = true,
}: UseComplianceQueryOptions<TParams>) {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const queryKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetcherRef.current(paramsRef.current, {
          signal: controller.signal,
        });

        if (response.status === 200) {
          setData(response.body as TData);
        } else {
          const body = response.body as { error?: string; message?: string } | null | undefined;
          setError(body?.error || body?.message || fallbackErrorMessage);
          setData(null);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        const message =
          err instanceof Error && err.message.trim() !== ''
            ? err.message
            : fallbackErrorMessage;

        setError(message);
        setData(null);
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
  }, [queryKey, fallbackErrorMessage, enabled]);

  return { data, isLoading, error };
}