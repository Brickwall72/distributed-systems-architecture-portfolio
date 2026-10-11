// File: services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.unit.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTemplateQuery } from './useTemplateQuery';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    getTemplate: vi.fn(),
  },
}));

describe('useTemplateQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches full template DTO when ID is provided', async () => {
    const mockDto = { id: 't1', name: 'Form A', rawHTML: '<p>HTML</p>' };
    vi.mocked(apiClient.getTemplate).mockResolvedValue({
      status: 200,
      body: mockDto as any,
      headers: new Headers(),
    });

    const { result } = renderHook(() => useTemplateQuery('t1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDto);
    expect(apiClient.getTemplate).toHaveBeenCalledWith({
      params: { id: 't1' },
      fetchOptions: expect.any(Object),
    });
  });

  it('does not invoke fetcher when id is undefined', async () => {
    const { result } = renderHook(() => useTemplateQuery(undefined));

    // Should complete/skip loading immediately without making an API call
    expect(apiClient.getTemplate).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});