// File: services/core/compliance-service/client/src/hooks/useCompliancePdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCompliancePdf } from './useCompliancePdf';
import { usePdfGenerator } from 'pdf-client';
import { useTemplateQuery } from '../templates';
import { hydrateTemplate } from '@shared/ui-components';
import { generateTemplatePayload } from '../../registry';

// Mock external dependencies
vi.mock('pdf-client', () => ({
  usePdfGenerator: vi.fn(),
}));

vi.mock('../templates', () => ({
  useTemplateQuery: vi.fn(),
}));

vi.mock('@shared/ui-components', () => ({
  hydrateTemplate: vi.fn((html, data) => `hydrated-${html}-${JSON.stringify(data)}`),
}));

vi.mock('../../registry', () => ({
  generateTemplatePayload: vi.fn((params) => ({ mockPayloadKey: params.templateId })),
}));

describe('useCompliancePdf', () => {
  const mockGenerate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePdfGenerator).mockReturnValue({
      generate: mockGenerate.mockResolvedValue('blob:test-pdf-url'),
      isGenerating: false,
      error: null,
    });
  });

  const defaultParams = {
    templateId: 'asset-transfer-authorization' as const,
    input: {
      sourceOrg: { id: '1', name: 'Src', type: 'GOV' as const },
      targetOrg: { id: '2', name: 'Dst', type: 'CONTRACTOR' as const },
      assets: [],
    },
  };

  it('aggregates loading and error states correctly from underlying hooks', () => {
    vi.mocked(useTemplateQuery).mockReturnValue({
      data: null,
      isLoading: true,
      error: 'Template fetch failed',
    });

    const { result } = renderHook(() => useCompliancePdf(defaultParams));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe('Template fetch failed');
  });

  it('successfully generates PDF and invokes onSuccess callback with blob URL', async () => {
    vi.mocked(useTemplateQuery).mockReturnValue({
      data: {
        id: 'asset-transfer-authorization',
        name: 'Transfer',
        type: 'AUTHORIZATION',
        rawHTML: '<p>Test</p>',
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCompliancePdf(defaultParams));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(mockOnSuccess);
    });

    // Verifies payload generation and template hydration occurred
    expect(generateTemplatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'asset-transfer-authorization',
        usePlaceholders: false,
      })
    );
    expect(hydrateTemplate).toHaveBeenCalledWith('<p>Test</p>', { mockPayloadKey: 'asset-transfer-authorization' });

    // Verifies pdf generator was invoked and success callback triggered
    expect(mockGenerate).toHaveBeenCalledWith('hydrated-<p>Test</p>-{"mockPayloadKey":"asset-transfer-authorization"}');
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:test-pdf-url');
  });

  it('does not invoke PDF generation if template data or rawHTML is missing', async () => {
    vi.mocked(useTemplateQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCompliancePdf(defaultParams));
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(mockOnSuccess);
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});