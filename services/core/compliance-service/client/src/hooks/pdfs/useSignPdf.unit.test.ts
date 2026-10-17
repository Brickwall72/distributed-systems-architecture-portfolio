// File: services/platform/compliance/client/src/hooks/useSignPdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSignPdf, SignPdfParams } from './useSignPdf';
import { signDocument } from 'esign-client';

vi.mock('esign-client', () => ({
  signDocument: vi.fn(),
}));

describe('useSignPdf Hook', () => {
  const defaultParams: SignPdfParams = {
    pdfBlobUrl: 'blob:http://localhost/mock-pdf',
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
    const mockSignedUrl = 'blob:http://localhost/signed-result-pdf';
    vi.mocked(signDocument).mockResolvedValueOnce(mockSignedUrl);
    const mockOnSuccess = vi.fn();

    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf(defaultParams, 'data:image/png;base64,sigData', mockOnSuccess);
    });

    expect(signDocument).toHaveBeenCalledWith({
      pdfBlobUrl: defaultParams.pdfBlobUrl,
      signatureDataUrl: 'data:image/png;base64,sigData',
      documentId: defaultParams.documentId,
      signerId: defaultParams.signerId,
      entityId: defaultParams.entityId,
      customPath: defaultParams.customPath,
      documentType: defaultParams.documentType,
    });
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockOnSuccess).toHaveBeenCalledWith(mockSignedUrl);
  });

  it('sets error and aborts if pdfBlobUrl is missing', async () => {
    const mockOnSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf(
        { ...defaultParams, pdfBlobUrl: '' },
        'data:image/png;base64,sigData',
        mockOnSuccess
      );
    });

    expect(signDocument).not.toHaveBeenCalled();
    expect(result.current.error).toBe('No PDF blob available to sign.');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('captures error, sets error message, and rethrows when signDocument fails', async () => {
    const backendError = new Error('Cryptographic P12 certificate seal failure');
    vi.mocked(signDocument).mockRejectedValueOnce(backendError);
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

    expect(thrownError).toEqual(backendError);
    expect(result.current.error).toBe('Cryptographic P12 certificate seal failure');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('resets signing state correctly', async () => {
    vi.mocked(signDocument).mockResolvedValueOnce('blob:http://localhost/signed-pdf');
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