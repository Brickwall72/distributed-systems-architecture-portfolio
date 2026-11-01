// File: services/core/compliance-service/client/src/hooks/useGeneratePdf.unit.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGeneratePdf } from './useGeneratePdf';
import { apiClient } from '../../api';
import { z } from 'zod';
import {
  TemplateDraftResponseSchema,
  masterPayloadInputSchema,
  templateDTOSchema,
  type TemplateDTOwithPayloadSchema,
} from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';

// Mock external dependencies
vi.mock('../../api', () => ({
  apiClient: {
    createTemplateDraft: vi.fn(),
  },
}));

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:test-pdf-url');
URL.createObjectURL = mockCreateObjectURL;

// Mock global fetch for pre-signed URL download
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useGeneratePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Stand-in parser so the hook's payload handoff is observable without coupling to real form schemas
  const payloadSchema = z
    .object({}).passthrough()
    .pipe(z.object({}).passthrough().transform((data) => ({ ...data, parsedByTemplate: true })));

  // zocker can't generate `.trim().min()` chains, so the name is supplied
  const template = mockFromSchema(templateDTOSchema, { name: 'Asset Transfer Authorization' });
  const templateWithSchema = { ...template, payloadSchema } as unknown as TemplateDTOwithPayloadSchema;

  const payloadData = mockFromSchema(masterPayloadInputSchema, {
    sourceOrg: { id: '1', name: 'Src' },
    targetOrg: { id: '2', name: 'Dst' },
    assets: [],
  } as never);

  const defaultParams = { template: templateWithSchema, payloadData };

  const draftResponse = (overrides = {}) =>
    mockFromSchema(TemplateDraftResponseSchema, {
      fileHash: SHA256_HEX,
      documentName: template.id,
      presignedUrl: 'http://localhost:9000/dsap/test-document.pdf?signature=xyz',
      ...overrides,
    });

  it('initializes with default loading, error, and unsignedDocumentData states', () => {
    const { result } = renderHook(() => useGeneratePdf());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.unsignedDocumentData).toBeNull();
  });

  it('does not invoke API if the source organization is missing', async () => {
    const { result } = renderHook(() => useGeneratePdf());
    const mockOnSuccess = vi.fn();

    await act(async () => {
      await result.current.generatePdf({ ...defaultParams, payloadData: { ...payloadData, sourceOrg: undefined }, onSuccess: mockOnSuccess });
    });

    expect(apiClient.createTemplateDraft).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.unsignedDocumentData).toBeNull();
  });

  it('successfully generates draft, fetches via pre-signed URL, converts to Blob, and sets unsignedDocumentData', async () => {
    const draft = draftResponse();
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: draft,
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
      await result.current.generatePdf({ ...defaultParams, onSuccess: mockOnSuccess });
    });

    // Verifies the raw (unparsed) payload is sent so the server owns parsing and requisition numbering
    expect(apiClient.createTemplateDraft).toHaveBeenCalledWith({
      params: { id: template.id },
      body: { data: payloadData },
    });

    // Verifies fetch was called with the pre-signed URL
    expect(mockFetch).toHaveBeenCalledWith(draft.presignedUrl);

    // Verifies blob creation, unsignedDocumentData state update, and success callback trigger
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockOnSuccess).toHaveBeenCalledWith('blob:test-pdf-url');
    expect(result.current.error).toBeNull();
    expect(result.current.unsignedDocumentData).toMatchObject({
      storageBucket: draft.storageBucket,
      storageKey: draft.storageKey,
      requisitionNumber: draft.requisitionNumber,
      senderOrgId: payloadData.sourceOrg?.id,
      receiverOrgId: payloadData.targetOrg?.id,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('reports an HTML storage response instead of displaying it as a blank PDF', async () => {
    const draft = draftResponse();
    vi.mocked(apiClient.createTemplateDraft).mockResolvedValueOnce({
      status: 201,
      body: draft,
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
      await result.current.generatePdf({ ...defaultParams, onSuccess: mockOnSuccess });
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
      await result.current.generatePdf({ ...defaultParams, onSuccess: mockOnSuccess });
    });

    expect(result.current.error).toBe('Internal server error creating template draft PDF.');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.unsignedDocumentData).toBeNull();
  });
});