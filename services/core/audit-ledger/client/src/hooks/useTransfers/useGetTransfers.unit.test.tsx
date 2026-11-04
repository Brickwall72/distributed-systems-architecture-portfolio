import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { transferSummarySchema } from 'audit-shared';
import { mockFromSchema } from '@shared/testing';
import { useGetTransfers } from './useGetTransfers';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: {
    getTransfers: vi.fn(),
  },
}));

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useGetTransfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the transfer summaries and forwards the query to the API', async () => {
    const transfers = [mockFromSchema(transferSummarySchema), mockFromSchema(transferSummarySchema)];
    vi.mocked(apiClient.getTransfers).mockResolvedValueOnce({ status: 200, body: transfers, headers: new Headers() });
    const query = { status: 'SEALED' as const, limit: 10 };

    const { result } = renderHook(() => useGetTransfers(query), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(transfers);
    expect(apiClient.getTransfers).toHaveBeenCalledWith({ query });
  });

  it.each([
    ['the error field', { error: 'ledger offline' }, 'ledger offline'],
    ['the message field', { message: 'bad gateway' }, 'bad gateway'],
    ['a status fallback', {}, 'Failed to fetch transfers: HTTP 500'],
  ])('surfaces a non-200 response using %s', async (_label, body, expected) => {
    vi.mocked(apiClient.getTransfers).mockResolvedValueOnce({ status: 500, body, headers: new Headers() } as never);

    const { result } = renderHook(() => useGetTransfers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(expected);
  });

  it('surfaces network failures thrown by the client', async () => {
    vi.mocked(apiClient.getTransfers).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useGetTransfers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('network down');
  });
});
