// File: services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTemplateQuery, clearTemplateCache } from './useTemplateQuery';
import { apiClient } from '../../api';
import type { FormId } from 'compliance-shared';

vi.mock('../../api', () => ({
  apiClient: {
    getTemplate: vi.fn(),
  },
}));

describe('useTemplateQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTemplateCache();
  });

  it('serves repeat requests for the same id from cache', async () => {
    const id: FormId = 'asset-transfer-authorization';
    vi.mocked(apiClient.getTemplate).mockResolvedValue({
      status: 200,
      body: { id, name: 'Form A', rawHTML: '<p>HTML</p>' } as any,
      headers: new Headers(),
    });

    const first = renderHook(() => useTemplateQuery(id));
    await waitFor(() => expect(first.result.current.data).not.toBeNull());
    const second = renderHook(() => useTemplateQuery(id));
    await waitFor(() => expect(second.result.current.data).not.toBeNull());

    expect(apiClient.getTemplate).toHaveBeenCalledTimes(1);
  });

  it('fetches full template DTO when ID is provided', async () => {
    const validTemplateId: FormId = 'asset-transfer-authorization';
    const mockDto = { id: validTemplateId, name: 'Form A', rawHTML: '<p>HTML</p>', type: 'AUTHORIZATION' };
    
    vi.mocked(apiClient.getTemplate).mockResolvedValue({
      status: 200,
      body: mockDto as any,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useTemplateQuery(validTemplateId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDto);
    expect(apiClient.getTemplate).toHaveBeenCalledWith({
      params: { id: validTemplateId },
      fetchOptions: expect.any(Object),
    });
  });

  it('does not invoke fetcher when id is undefined', async () => {
    const { result } = renderHook(() => useTemplateQuery(undefined));

    // Should complete/skip loading immediately without making an API call
    expect(apiClient.getTemplate).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});