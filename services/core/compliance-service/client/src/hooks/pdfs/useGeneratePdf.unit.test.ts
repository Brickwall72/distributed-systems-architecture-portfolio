// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGeneratePdf } from './useGeneratePdf';
import { apiClient } from '../../api';
import { generateTemplatePayload, PayloadParams } from '../../registry';

// Mock external dependencies
vi.mock('../../api', () => ({
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

  const mockStorageArtifact = {
    id: '3ef7a5e5-72d3-47df-a5d6-f3e871e34df9',
    storageBucket: 'drafts',
    storageKey: 'org-123/transfers/asset-transfer-authorization/REQ-2026-0001.pdf',
    fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    presignedUrl: 'http://localhost:9000/dsap/test-document.pdf?signature=xyz',
  };

  it('initializes with default loading, error, and storageArtifact states', () => {
    const { result } = renderHook(() => useGeneratePdf());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.storageArtifact).toBeNull();
  });

  it('does not invoke API if templateId is missing', async () => {
    const { result } = renderHook(() => useGeneratePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf({ ...defaultParams, templateId: '' as any }, mockOnSuccess);
    });

    expect(apiClient.createTemplateDraft).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.storageArtifact).toBeNull();
  });

  it('successfully generates draft, fetches via pre-signed URL, converts to Blob, and sets storageArtifact', async () => {
    // 1. Mock backend response returning StorageArtifact + pre-signed URL
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: mockStorageArtifact,
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
    expect(mockFetch).toHaveBeenCalledWith(mockStorageArtifact.presignedUrl);

    // Verifies blob creation, storageArtifact state update, and success callback trigger
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:test-pdf-url');
    expect(result.current.storageArtifact).toEqual({
      id: mockStorageArtifact.id,
      storageBucket: mockStorageArtifact.storageBucket,
      storageKey: mockStorageArtifact.storageKey,
      fileHash: mockStorageArtifact.fileHash,
      createdAt: mockStorageArtifact.createdAt,
      updatedAt: mockStorageArtifact.updatedAt,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('reports an HTML storage response instead of displaying it as a blank PDF', async () => {
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: mockStorageArtifact,
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
    expect(result.current.storageArtifact).toBeNull();
  });
});