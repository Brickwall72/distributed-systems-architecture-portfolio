// File: services/core/compliance-service/client/src/hooks/documents/useDocumentSync.unit.test.tsx
import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockFromSchema, setTestSession } from '@shared/testing';
import { DocumentSchema } from 'compliance-shared';
import { apiClient } from '../../api';
import { useDocumentSync } from './useDocumentSync';

vi.mock('../../api', () => ({ apiClient: { getDocumentById: vi.fn() } }));

describe('useDocumentSync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the authorized document and reconciles pending to applied', async () => {
    setTestSession();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const document = mockFromSchema(DocumentSchema, { topologyApplicationStatus: 'PENDING' });
    vi.mocked(apiClient.getDocumentById)
      .mockResolvedValueOnce({ status: 200, body: document, headers: new Headers() })
      .mockResolvedValueOnce({ status: 200, body: { ...document, topologyApplicationStatus: 'APPLIED' }, headers: new Headers() });
    const { result, unmount } = renderHook(() => useDocumentSync(document.id), { wrapper });
    await waitFor(() => expect(result.current.data).toMatchObject({ topologyApplicationStatus: 'PENDING' }));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.data).toMatchObject({ topologyApplicationStatus: 'APPLIED' }));
    expect(apiClient.getDocumentById).toHaveBeenCalledWith(expect.objectContaining({ params: { id: document.id } }));
    unmount();
    client.clear();
  });

  it('automatically polls pending and attention-required documents until applied', async () => {
    setTestSession();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const document = mockFromSchema(DocumentSchema, { topologyApplicationStatus: 'PENDING' });
    vi.mocked(apiClient.getDocumentById)
      .mockResolvedValueOnce({ status: 200, body: document, headers: new Headers() })
      .mockResolvedValueOnce({ status: 200, body: { ...document, topologyApplicationStatus: 'ATTENTION_REQUIRED' }, headers: new Headers() })
      .mockResolvedValue({ status: 200, body: { ...document, topologyApplicationStatus: 'APPLIED' }, headers: new Headers() });
    const { result, unmount } = renderHook(() => useDocumentSync(document.id), { wrapper });
    try {
      await waitFor(() => expect(result.current.data).toMatchObject({ topologyApplicationStatus: 'ATTENTION_REQUIRED' }), { timeout: 7000 });
      await waitFor(() => expect(result.current.data).toMatchObject({ topologyApplicationStatus: 'APPLIED' }), { timeout: 7000 });
      expect(apiClient.getDocumentById).toHaveBeenCalledTimes(3);
      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(apiClient.getDocumentById).toHaveBeenCalledTimes(3);
    } finally {
      unmount();
      client.clear();
    }
  }, 20000);
});
