// File: services/core/compliance-service/client/src/hooks/useComplianceTemplates/useComplianceTemplates.unit.test.ts
import { renderHook, waitFor, act } from '@testing-library/react';
import { useComplianceTemplates } from './useComplianceTemplates';
import { fetchTemplateManifest, fetchTemplateContent } from '../../api';

vi.mock('../../api', () => ({
  fetchTemplateManifest: vi.fn(),
  fetchTemplateContent: vi.fn(),
}));

describe('useComplianceTemplates (Hook)', () => {
  const mockFetchManifest = vi.mocked(fetchTemplateManifest);
  const mockFetchContent = vi.mocked(fetchTemplateContent);
  const mockOnTemplateLoad = vi.fn();

  const mockManifest = [
    { id: 'dd-1149', name: 'DD Form 1149' },
    { id: 'da-2062', name: 'DA Form 2062' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches manifest on mount and transforms items into select options', async () => {
    mockFetchManifest.mockResolvedValueOnce(mockManifest);

    const { result } = renderHook(() =>
      useComplianceTemplates({
        selectedId: 'dd-1149',
        onTemplateLoad: mockOnTemplateLoad,
      })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.options).toEqual([
      { value: 'dd-1149', label: 'DD Form 1149' },
      { value: 'da-2062', label: 'DA Form 2062' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('auto-loads the first template if no selectedId is provided', async () => {
    mockFetchManifest.mockResolvedValueOnce(mockManifest);
    mockFetchContent.mockResolvedValueOnce('<html>DD 1149 Content</html>');

    renderHook(() =>
      useComplianceTemplates({
        selectedId: undefined,
        onTemplateLoad: mockOnTemplateLoad,
      })
    );

    await waitFor(() => {
      expect(mockFetchContent).toHaveBeenCalledWith('dd-1149');
      expect(mockOnTemplateLoad).toHaveBeenCalledWith('dd-1149', '<html>DD 1149 Content</html>');
    });
  });

  it('executes fetchTemplateContent and triggers callback on selectTemplate', async () => {
    mockFetchManifest.mockResolvedValueOnce(mockManifest);
    mockFetchContent.mockResolvedValueOnce('<html>DA 2062 Content</html>');

    const { result } = renderHook(() =>
      useComplianceTemplates({
        selectedId: 'dd-1149',
        onTemplateLoad: mockOnTemplateLoad,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.selectTemplate('da-2062');
    });

    expect(mockFetchContent).toHaveBeenCalledWith('da-2062');
    expect(mockOnTemplateLoad).toHaveBeenCalledWith('da-2062', '<html>DA 2062 Content</html>');
  });

  it('sets error state when manifest request fails', async () => {
    mockFetchManifest.mockRejectedValueOnce(new Error('Manifest load failed'));

    const { result } = renderHook(() =>
      useComplianceTemplates({
        onTemplateLoad: mockOnTemplateLoad,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Manifest load failed');
  });

  it('sets error state when template content request fails', async () => {
    mockFetchManifest.mockResolvedValueOnce(mockManifest);
    mockFetchContent.mockRejectedValueOnce(new Error('Content load failed'));

    const { result } = renderHook(() =>
      useComplianceTemplates({
        selectedId: 'dd-1149',
        onTemplateLoad: mockOnTemplateLoad,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.selectTemplate('da-2062');
    });

    expect(result.current.error).toBe('Content load failed');
  });
});