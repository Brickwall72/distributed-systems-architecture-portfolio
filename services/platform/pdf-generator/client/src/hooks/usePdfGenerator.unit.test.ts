// File: services/platform/pdf-generator/client/src/hooks/usePdfGenerator.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePdfGenerator } from './usePdfGenerator';
import { generatePdf } from '../api/generatePdf';

vi.mock('../api/generatePdf', () => ({
  generatePdf: vi.fn(),
}));

describe('usePdfGenerator', () => {
  const mockGeneratePdf = vi.mocked(generatePdf);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default states', () => {
    const { result } = renderHook(() => usePdfGenerator());

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.generate).toBe('function');
  });

  it('should return early and do nothing if htmlPayload is empty', async () => {
    const { result } = renderHook(() => usePdfGenerator());

    await act(async () => {
      const res = await result.current.generate('');
      expect(res).toBeUndefined();
    });

    expect(mockGeneratePdf).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it('should handle successful generation with custom onSuccess callback', async () => {
    const mockBlobUrl = 'blob:http://localhost:3000/mock-uuid';
    mockGeneratePdf.mockResolvedValueOnce(mockBlobUrl);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePdfGenerator({ onSuccess }));

    let returnedUrl: string | undefined;

    await act(async () => {
      returnedUrl = await result.current.generate('<h1>Test PDF</h1>');
    });

    expect(mockGeneratePdf).toHaveBeenCalledWith('<h1>Test PDF</h1>');
    expect(onSuccess).toHaveBeenCalledWith(mockBlobUrl);
    expect(returnedUrl).toBe(mockBlobUrl);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should trigger automatic anchor tag download when onSuccess is omitted', async () => {
    const mockBlobUrl = 'blob:http://localhost:3000/mock-uuid';
    mockGeneratePdf.mockResolvedValueOnce(mockBlobUrl);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(Element.prototype, 'remove').mockImplementation(() => {});

    const { result } = renderHook(() =>
      usePdfGenerator({ fileName: 'custom-report.pdf' })
    );

    await act(async () => {
      await result.current.generate('<div>Download Me</div>');
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('should fall back to default "document.pdf" when fileName is omitted in auto-download path', async () => {
    const mockBlobUrl = 'blob:http://localhost:3000/mock-uuid';
    mockGeneratePdf.mockResolvedValueOnce(mockBlobUrl);

    let createdAnchor: HTMLAnchorElement | null = null;
    const realCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') {
        createdAnchor = element as HTMLAnchorElement;
        vi.spyOn(createdAnchor, 'click').mockImplementation(() => {});
      }
      return element;
    });

    const { result } = renderHook(() => usePdfGenerator());

    await act(async () => {
      await result.current.generate('<div>Default Filename Test</div>');
    });

    const anchor = createdAnchor as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor?.download).toBe('document.pdf');
    expect(anchor?.href).toBe(mockBlobUrl);

    vi.restoreAllMocks();
  });

  it('should handle API errors, set error state, execute onError callback, and re-throw', async () => {
    const mockError = new Error('Network error generating PDF');
    mockGeneratePdf.mockRejectedValueOnce(mockError);

    const onError = vi.fn();
    const { result } = renderHook(() => usePdfGenerator({ onError }));

    await act(async () => {
      await expect(
        result.current.generate('<h1>Fail</h1>')
      ).rejects.toThrow('Network error generating PDF');
    });

    expect(result.current.error).toEqual(mockError);
    expect(onError).toHaveBeenCalledWith(mockError);
    expect(result.current.isGenerating).toBe(false);
  });

  it('should normalize non-Error throwables into standard Error objects', async () => {
    mockGeneratePdf.mockRejectedValueOnce('Raw string error');

    const onError = vi.fn();
    const { result } = renderHook(() => usePdfGenerator({ onError }));

    await act(async () => {
      await expect(
        result.current.generate('<h1>Fail Raw String</h1>')
      ).rejects.toThrow('PDF generation failed');
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('PDF generation failed');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});