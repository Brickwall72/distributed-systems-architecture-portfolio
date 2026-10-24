import { renderHook, act } from '@testing-library/react';
import { SignDocumentResponseSchema } from '@contracts/esign';
import { signDocumentApiRequestSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { useSignPdf, signPdfParamsSchema } from './useSignPdf';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: {
    signDocument: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;
URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/signed-result-pdf');

const SIGNATURE_BASE64 = 'sigData';

describe('useSignPdf Hook', () => {
  const buildParams = () =>
    mockFromSchema(signPdfParamsSchema, {
      fileHash: SHA256_HEX,
      signerId: 'usr_1',
      documentName: 'asset-transfer-authorization',
      documentType: 'AUTHORIZATION',
      signatureDataUrl: `data:image/png;base64,${SIGNATURE_BASE64}`,
    });

  const signedResponse = () =>
    mockFromSchema(SignDocumentResponseSchema, {
      success: true,
      fileHash: SHA256_HEX,
      presignedUrl: 'http://localhost:9000/dsap/signed.pdf?signature=123',
    });

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

  it('sends a body valid against the shared request schema, then invokes onSuccess', async () => {
    const params = buildParams();
    const response = signedResponse();
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({ status: 200, body: response, headers: new Headers() } as never);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['pdf-bytes'], { type: 'application/pdf' })),
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    await act(async () => {
      await result.current.signPdf({ params, onSuccess });
    });

    const { body } = vi.mocked(apiClient.signDocument).mock.calls[0][0] as { body: unknown };
    expect(signDocumentApiRequestSchema.parse(body)).toMatchObject({
      documentId: params.documentId,
      storageKey: params.storageKey,
      signatureImageBase64: SIGNATURE_BASE64,
    });
    expect(body).not.toHaveProperty('signatureDataUrl');
    expect(mockFetch).toHaveBeenCalledWith(response.presignedUrl);
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(true);
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith('blob:http://localhost/signed-result-pdf');
  });

  it('rejects params that fail the request schema without calling the API', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());
    const invalid = { ...buildParams(), documentName: 'not-a-form' } as never;

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.signPdf({ params: invalid, onSuccess });
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeDefined();
    expect(apiClient.signDocument).not.toHaveBeenCalled();
    expect(result.current.error).toBeTypeOf('string');
    expect(result.current.isSigned).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('captures the error message and rethrows when the API responds with a failure', async () => {
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({
      status: 500,
      body: { error: 'Remote signature generation failed.' },
    } as never);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSignPdf());

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.signPdf({ params: buildParams(), onSuccess });
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toEqual(new Error('Remote signature generation failed.'));
    expect(result.current.error).toBe('Remote signature generation failed.');
    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('resets signing state correctly', async () => {
    vi.mocked(apiClient.signDocument).mockResolvedValueOnce({ status: 200, body: signedResponse() } as never);
    mockFetch.mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['pdf'])) });

    const { result } = renderHook(() => useSignPdf());
    await act(async () => {
      await result.current.signPdf({ params: buildParams(), onSuccess: vi.fn() });
    });
    expect(result.current.isSigned).toBe(true);

    act(() => result.current.resetSigningState());

    expect(result.current.isSigning).toBe(false);
    expect(result.current.isSigned).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
