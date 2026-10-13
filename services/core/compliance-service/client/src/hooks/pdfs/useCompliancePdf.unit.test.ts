// File: services/core/compliance-service/client/src/hooks/useCompliancePdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCompliancePdf } from './useCompliancePdf';
import { apiClient } from '../../api/client';
import { generateTemplatePayload, PayloadParams } from '../../registry';

// Mock external dependencies
vi.mock('../../api/client', () => ({
  apiClient: {
    createTemplateDraft: vi.fn(),
  },
}));

vi.mock('../../registry', () => ({
  generateTemplatePayload: vi.fn((params) => ({ mockPayloadKey: params.templateId })),
}));

// Mock URL.createObjectURL and atob if needed
const mockCreateObjectURL = vi.fn(() => 'blob:test-pdf-url');
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
  },
  writable: true,
});

describe('useCompliancePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams: PayloadParams = {
    templateId: 'asset-transfer-authorization',
    input: {
      sourceOrg: { id: '1', name: 'Src', type: 'GOV' },
      targetOrg: { id: '2', name: 'Dst', type: 'CONTRACTOR' },
      assets: [],
    },
  };

  it('initializes with default loading and error states', () => {
    const { result } = renderHook(() => useCompliancePdf());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not invoke API if templateId is missing', async () => {
    const { result } = renderHook(() => useCompliancePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf({ ...defaultParams, templateId: '' as any }, mockOnSuccess);
    });

    expect(apiClient.createTemplateDraft).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('successfully generates draft, converts base64 to Blob, and triggers onSuccess with blob URL', async () => {
    const fakeBase64 = btoa('dummy-pdf-binary-content');
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: {
        draftId: 'draft-123',
        pdfBase64: fakeBase64,
        requisitionNumber: 'REQ-2026-0001',
      },
      headers: new Headers(),
    });

    const { result } = renderHook(() => useCompliancePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(defaultParams, mockOnSuccess);
    });

    // Verifies payload generation occurred
    expect(generateTemplatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'asset-transfer-authorization',
        usePlaceholders: false,
      })
    );

    // Verifies backend API call
    expect(apiClient.createTemplateDraft).toHaveBeenCalledWith({
      params: { id: 'asset-transfer-authorization' },
      body: { mockPayloadKey: 'asset-transfer-authorization' },
    });

    // Verifies blob creation and success callback trigger
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:test-pdf-url');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('handles API error responses and updates error state correctly', async () => {
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 500,
      body: {
        error: 'Internal server error creating template draft PDF.',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      },
      headers: new Headers(),
    });

    const { result } = renderHook(() => useCompliancePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(defaultParams, mockOnSuccess);
    });

    expect(result.current.error).toBe('Internal server error creating template draft PDF.');
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});