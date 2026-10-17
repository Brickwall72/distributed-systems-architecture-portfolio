// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGeneratePdf } from './useGeneratePdf';
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

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:test-pdf-url');
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
  },
  writable: true,
});

// Mock global fetch for pre-signed URL download
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useGeneratePdf', () => {
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
    const { result } = renderHook(() => useGeneratePdf());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not invoke API if templateId is missing', async () => {
    const { result } = renderHook(() => useGeneratePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf({ ...defaultParams, templateId: '' as any }, mockOnSuccess);
    });

    expect(apiClient.createTemplateDraft).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('successfully generates draft, fetches via pre-signed URL, converts to Blob, and triggers onSuccess', async () => {
    // 1. Mock backend response returning pre-signed URL
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: {
        draftId: 'draft-123',
        presignedUrl: 'http://localhost:9000/dsap/test-document.pdf?signature=xyz',
        requisitionNumber: 'REQ-2026-0001',
      },
      headers: new Headers(),
    });

    // 2. Mock fetch response for pre-signed URL download
    const mockBlob = new Blob(['dummy-pdf-binary-content'], { type: 'application/pdf' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      blob: async () => mockBlob,
    });

    const { result } = renderHook(() => useGeneratePdf());
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

    // Verifies fetch was called with the pre-signed URL
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:9000/dsap/test-document.pdf?signature=xyz');

    // Verifies blob creation and success callback trigger
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:test-pdf-url');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('reports an HTML storage response instead of displaying it as a blank PDF', async () => {
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: {
        draftId: 'draft-123',
        presignedUrl: 'http://minio.localhost:8081/dsap/test-document.pdf?signature=xyz',
        requisitionNumber: 'REQ-2026-0001',
      },
      headers: new Headers(),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      blob: async () => new Blob(['<html>MinIO console</html>'], { type: 'text/html' }),
    });

    const { result } = renderHook(() => useGeneratePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(defaultParams, mockOnSuccess);
    });

    expect(result.current.error).toBe('Expected a PDF from storage but received text/html');
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
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

    const { result } = renderHook(() => useGeneratePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf(defaultParams, mockOnSuccess);
    });

    expect(result.current.error).toBe('Internal server error creating template draft PDF.');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});