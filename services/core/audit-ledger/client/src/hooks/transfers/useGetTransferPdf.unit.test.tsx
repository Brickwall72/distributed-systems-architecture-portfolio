// File: service/core/audit-ledger/client/src/hooks/useTransfers/useGetTransferPdf.unit.test.ts
import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestSession } from '@shared/testing';
import { apiClient } from '../../api';
import { useGetTransferPdf } from './useGetTransferPdf';

vi.mock('../../api', () => ({ apiClient: { getTransferDocument: vi.fn() } }));

describe('useGetTransferPdf', () => {
  let client: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;
  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } })));
    vi.mocked(apiClient.getTransferDocument).mockResolvedValue({
      status: 200, body: { presignedUrl: 'https://storage.example/file.pdf' }, headers: new Headers(),
    });
  });
  afterEach(() => { client.clear(); vi.unstubAllGlobals(); });

  it('requires a profile and selection, and reuses a cached PDF', async () => {
    setTestSession(null);
    const { result, rerender } = renderHook(({ id }) => useGetTransferPdf(id), {
      initialProps: { id: 'REQ-1' as string | undefined }, wrapper,
    });
    expect(apiClient.getTransferDocument).not.toHaveBeenCalled();
    act(() => setTestSession());
    await waitFor(() => expect(result.current.data).toBeInstanceOf(Blob));
    const blob = result.current.data;
    rerender({ id: undefined });
    rerender({ id: 'REQ-1' });
    await waitFor(() => expect(result.current.data).toBe(blob));
    expect(apiClient.getTransferDocument).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://storage.example/file.pdf', { signal: expect.any(AbortSignal) });
  });

  it('rejects non-PDF content and propagates cancellation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('html', { headers: { 'Content-Type': 'text/html' } }));
    const first = renderHook(() => useGetTransferPdf('REQ-1'), { wrapper });
    await waitFor(() => expect(first.result.current.error?.message).toContain('Expected a PDF'));
    first.unmount();
    vi.mocked(apiClient.getTransferDocument).mockImplementation(() => new Promise(() => {}));
    const second = renderHook(({ id }) => useGetTransferPdf(id), { initialProps: { id: 'REQ-2' as string | undefined }, wrapper });
    await waitFor(() => expect(apiClient.getTransferDocument).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(apiClient.getTransferDocument).mock.calls[1][0].fetchOptions?.signal;
    second.rerender({ id: undefined });
    expect(signal?.aborted).toBe(true);
  });
});
