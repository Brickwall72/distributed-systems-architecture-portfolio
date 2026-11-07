import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestSession } from '@shared/testing';
import { apiClient } from '../../api';
import { useGetPdf } from './useGetPdf';

vi.mock('../../api', () => ({ apiClient: { getDocumentContentById: vi.fn() } }));

describe('useGetPdf', () => {
  const documentId = '123e4567-e89b-12d3-a456-426614174000';
  let client: QueryClient;
  let fetchPdf: ReturnType<typeof vi.fn>;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    fetchPdf = vi.fn().mockResolvedValue(new Response('pdf bytes', { headers: { 'Content-Type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchPdf);
    vi.mocked(apiClient.getDocumentContentById).mockResolvedValue({
      status: 200, body: { presignedUrl: 'https://storage.example/file.pdf' }, headers: new Headers(),
    });
  });

  afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
  });

  it('only fetches when a profile and document are selected and reuses a fresh cached blob', async () => {
    setTestSession(null);
    const { result, rerender } = renderHook(({ id }) => useGetPdf(id), {
      initialProps: { id: documentId as string | undefined }, wrapper,
    });
    expect(apiClient.getDocumentContentById).not.toHaveBeenCalled();
    act(() => setTestSession());
    await waitFor(() => expect(result.current.data).toBeInstanceOf(Blob));
    const blob = result.current.data;
    rerender({ id: undefined });
    rerender({ id: documentId });
    await waitFor(() => expect(result.current.data).toBe(blob));
    expect(apiClient.getDocumentContentById).toHaveBeenCalledTimes(1);
    expect(fetchPdf).toHaveBeenCalledWith('https://storage.example/file.pdf', { signal: expect.any(AbortSignal) });
  });

  it('reports a failed storage download', async () => {
    fetchPdf.mockResolvedValue(new Response(null, { status: 403 }));
    const { result } = renderHook(() => useGetPdf(documentId), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('HTTP 403');
  });

  it('rejects a non-PDF response', async () => {
    fetchPdf.mockResolvedValue(new Response('not a PDF', { headers: { 'Content-Type': 'text/html' } }));
    const { result } = renderHook(() => useGetPdf(documentId), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Expected a PDF');
  });

  it('aborts an in-flight API request when selection changes', async () => {
    vi.mocked(apiClient.getDocumentContentById).mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ id }) => useGetPdf(id), {
      initialProps: { id: documentId as string | undefined }, wrapper,
    });
    await waitFor(() => expect(apiClient.getDocumentContentById).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(apiClient.getDocumentContentById).mock.calls[0][0].fetchOptions?.signal;
    rerender({ id: undefined });
    expect(signal?.aborted).toBe(true);
  });
});
