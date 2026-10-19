// File: services/platform/compliance/client/src/hooks/useSignPdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSignPdf, SignPdfParams } from './useSignPdf';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: {
    signDocument: vi.fn(),
  },
}));

// Mock global fetch and URL.createObjectURL
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/signed-result-pdf');

describe('useSignPdf Hook', () => {
  const defaultParams: SignPdfParams = {
    storageArtifact: {
      storageBucket: 'dsap',
      storageKey: 'tenant-123/source.pdf',
      fileHash: 'a'.repeat(64),
      id: 'artifact-001',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    documentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    signerId: 'usr-actor-404',
    entityId: 'org-armory-01',
    customPath: 'transfers/forms/document',
    documentType: 'DD-1149',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSignPdf());

    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.signPdf).toBe('function');
    expect(typeof result.current.resetSigningState).toBe('function');
  });

  it('handles successful signing flow and invokes onSuccess callback', async () => {
    const mockPresignedUrl = 'http://localhost:9000/dsap/signed.pdf?signature=123';
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({
      status: 200,
      body: {
        id: defaultParams.documentId,
        storageBucket: 'dsap',
        storageKey: 'tenant-123/signed.pdf',
        presignedUrl: mockPresignedUrl,
      },
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['pdf-bytes'], { type: 'application/pdf' })),
    });

    const mockOnSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf(defaultParams, 'data:image/png;base64,sigData', mockOnSuccess);
    });

    expect(apiClient.signDocument).toHaveBeenCalledWith({
      body: {
        storageBucket: defaultParams.storageArtifact.storageBucket,
        storageKey: defaultParams.storageArtifact.storageKey,
        fileHash: defaultParams.storageArtifact.fileHash,
        signatureImageBase64: 'sigData',
        documentId: defaultParams.documentId,
        documentType: defaultParams.documentType,
        signerId: defaultParams.signerId,
        entityId: defaultParams.entityId,
        customPath: defaultParams.customPath,
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(mockPresignedUrl);
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:http://localhost/signed-result-pdf');
  });

  it('sets error and aborts if storageArtifact is missing', async () => {
    const mockOnSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf(
        { ...defaultParams, storageArtifact: undefined as any },
        'data:image/png;base64,sigData',
        mockOnSuccess
      );
    });

    expect(apiClient.signDocument).not.toHaveBeenCalled();
    expect(result.current.error).toBe('No storage artifact available to sign.');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('captures error, sets error message, and rethrows when apiClient.signDocument fails', async () => {
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({
      status: 500,
      body: { error: 'Remote signature generation failed.' },
    } as any);

    const mockOnSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.signPdf(defaultParams, 'data:image/png;base64,sigData', mockOnSuccess);
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toEqual(new Error('Remote signature generation failed.'));
    expect(result.current.error).toBe('Remote signature generation failed.');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('resets signing state correctly', async () => {
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({
      status: 200,
      body: { presignedUrl: 'http://localhost:9000/dsap/signed.pdf' },
    } as any);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['pdf'])),
    });

    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf(defaultParams, 'data:image/png;base64,sigData', vi.fn());
    });

    expect(result.current.isSigned).toBe(true);

    act(() => {
      result.current.resetSigningState();
    });

    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(result.current.error).toBeNull();
  });
});