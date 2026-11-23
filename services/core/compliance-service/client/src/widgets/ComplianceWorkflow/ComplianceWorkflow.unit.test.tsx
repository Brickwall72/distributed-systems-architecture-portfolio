// File: services/core/compliance-service/client/src/widgets/ComplianceWorkflow/ComplianceWorkflow.unit.test.tsx
import { act, render as renderWithTestingLibrary, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { z } from 'zod';
import { FORM_ID, FORM_TYPE, signDocumentApiRequestSchema, templateDTOSchema, type TemplateDTOwithPayloadSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { useGeneratePdf, useSignPdf, useTemplateQuery } from '../../hooks';
import type { Identity } from '@contracts/auth';
import type { ComplianceWorkflowWidgetProps } from '@contracts/compliance';

const session = vi.hoisted(() => ({
  identity: { id: 'usr_ksc_gov', displayName: 'KSC', orgId: 'org-ksc-gov', roles: ['org-member'], signerId: 'usr_ksc_gov' } as Identity | null,
  synchronizationStatus: undefined as string | undefined,
}));

// Mock the custom compliance hooks
vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useGeneratePdf: vi.fn(),
    useSignPdf: vi.fn(),
    useTemplateQuery: vi.fn(),
    useDocumentSync: vi.fn((id?: string) => ({
      data: id && session.synchronizationStatus ? { topologyApplicationStatus: session.synchronizationStatus } : undefined,
      error: null,
    })),
  };
});

vi.mock('@shared/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/ui-components')>();
  return {
    ...actual,
    useIdentity: () => session.identity,
    SignatureOverlay: ({ onSign, onCancel }: { onSign: (data: string) => void; onCancel: () => void }) => (
      <div data-testid="mock-signature-overlay">
        <button data-testid="mock-sign-submit" onClick={() => onSign('data:image/png;base64,sig')}>
          Sign and Submit
        </button>
        <button data-testid="mock-sign-cancel" onClick={onCancel}>
          Cancel Sign
        </button>
      </div>
    ),
    DocumentViewer: ({ content, children }: any) => (
      <div data-testid="document-viewer" data-content={content}>
        {content}
        {children}
      </div>
    ),
  };
});

vi.mock('@shared/utils', () => ({
  hydrateTemplate: vi.fn((html, data) => `hydrated:${html}:${JSON.stringify(data)}`),
}));

describe('ComplianceWorkflowWidget', () => {
  let queryClient: QueryClient;
  const render = (element: ReactElement) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderWithTestingLibrary(element, { wrapper });
  };
  const mockGeneratePdf = vi.fn(async ({ onSuccess }: { onSuccess: (blobUrl: string) => void }): Promise<void> => {
    onSuccess('blob:mock-pdf-url');
  });

  // Stand-in parser so rendering doesn't depend on the real form schemas
  const payloadSchema = z
    .object({}).passthrough()
    .pipe(z.object({}).passthrough().transform((data) => ({ ...data, parsedByTemplate: true })));
  // zocker can't generate `.trim().min()` chains, so the name is supplied
  const template = {
    ...mockFromSchema(templateDTOSchema, { name: 'Test Template' }),
    payloadSchema,
  } as unknown as TemplateDTOwithPayloadSchema;

  const mockSignPdf = vi.fn(async ({ onSuccess }: { params: unknown; onSuccess: (blobUrl: string) => void }): Promise<void> => {
    onSuccess('blob:mock-signed-pdf-url');
  });

  const mockResetSigningState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    session.synchronizationStatus = undefined;
    session.identity = { id: 'usr_ksc_gov', displayName: 'KSC', orgId: 'org-ksc-gov', roles: ['org-member'], signerId: 'usr_ksc_gov' };
    vi.mocked(useTemplateQuery).mockReturnValue({ data: null, isLoading: false, error: null });
    vi.mocked(useGeneratePdf).mockReturnValue({
      generatePdf: mockGeneratePdf,
      isLoading: false,
      error: null,
      unsignedDocumentData: mockFromSchema(signDocumentApiRequestSchema.omit({ signatureImageBase64: true, customPath: true, signerId: true }), {
        fileHash: SHA256_HEX,
        documentName: template.id,
        documentType: template.type,
      }),
    });

    vi.mocked(useSignPdf).mockReturnValue({
      signPdf: mockSignPdf,
      isSigning: false,
      isSigned: false,
      error: null,
      resetSigningState: mockResetSigningState,
    });
  });

  const defaultProps = {
    sourceOrg: { id: 'org-source', name: 'Source Org' },
    targetOrg: { id: 'org-target', name: 'Target Org' },
    assets: [{ id: 'asset-1', nomenclature: 'AN/PRC-117G', serialNumber: 'SN-1' }],
    template,
  };

  it('generates a PDF from the supplied template and entities', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    const generateBtn = screen.getByText('Authorize Transfer');
    expect(generateBtn.closest('button')).not.toBeDisabled();

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ id: template.id }),
          payloadData: expect.objectContaining({
            sourceOrg: expect.objectContaining({ id: 'org-source' }),
            targetOrg: expect.objectContaining({ id: 'org-target' }),
          }),
          onSuccess: expect.any(Function),
        })
      );
    });

    expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-pdf-url');
  });

  it('discards late previews and disables writes after switching to an auditor', async () => {
    let finish!: (url: string) => void;
    mockGeneratePdf.mockImplementationOnce(async ({ onSuccess }) => { finish = onSuccess; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} />);
    fireEvent.click(screen.getByText('Authorize Transfer'));

    session.identity = { id: 'auditor', displayName: 'Auditor', orgId: null, roles: ['auditor'], signerId: 'auditor' };
    rerender(<ComplianceWorkflowWidget {...defaultProps} />);
    await act(async () => finish('blob:stale-preview'));

    expect(revoke).toHaveBeenCalledWith('blob:stale-preview');
    expect(screen.getByText('Authorize Transfer').closest('button')).toBeDisabled();
    expect(screen.getByTestId('document-viewer').getAttribute('data-content')).not.toBe('blob:stale-preview');
    revoke.mockRestore();
  });

  it('discards a late draft when the selected assets change', async () => {
    let finish!: (url: string) => void;
    mockGeneratePdf.mockImplementationOnce(async ({ onSuccess }) => { finish = onSuccess; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} />);
    fireEvent.click(screen.getByText('Authorize Transfer'));

    rerender(<ComplianceWorkflowWidget {...defaultProps} assets={[{ id: 'asset-2', nomenclature: 'Other', serialNumber: 'SN-2' }]} />);
    await act(async () => finish('blob:old-asset-draft'));

    expect(revoke).toHaveBeenCalledWith('blob:old-asset-draft');
    expect(screen.getByText('Authorize Transfer')).toBeDefined();
    expect(screen.queryByText('Sign Authorization')).toBeNull();
    revoke.mockRestore();
  });

  it('closes an existing draft when a counterparty changes', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} />);
    fireEvent.click(screen.getByText('Authorize Transfer'));
    await waitFor(() => expect(screen.getByText('Sign Authorization')).toBeDefined());

    rerender(<ComplianceWorkflowWidget {...defaultProps} targetOrg={{ id: 'org-other', name: 'Other' }} />);

    expect(screen.queryByText('Sign Authorization')).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:mock-pdf-url');
    revoke.mockRestore();
  });

  it('swaps Authorize Transfer for Back to Interactive View and Sign Authorization once a PDF exists', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByText('Authorize Transfer'));

    await waitFor(() => expect(screen.getByText('Sign Authorization')).toBeDefined());
    expect(screen.queryByText('Authorize Transfer')).toBeNull();

    fireEvent.click(screen.getByText('Back to Interactive View'));

    expect(screen.getByText('Authorize Transfer')).toBeDefined();
    expect(screen.queryByText('Sign Authorization')).toBeNull();
    expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toContain('hydrated:');
  });

  it('uses receipt-specific labels and shows Signed after signing', async () => {
    vi.mocked(useTemplateQuery).mockReturnValue({
      data: { ...template, id: FORM_ID.ASSET_TRANSFER_RECEIPT, type: FORM_TYPE.RECEIPT },
      isLoading: false,
      error: null,
    });
    const props: ComplianceWorkflowWidgetProps = {
      ...defaultProps,
      requisitionNumber: 'REQ-1',
      authorizingTemplateId: FORM_ID.ASSET_TRANSFER_AUTHORIZATION,
      transferEventId: '123e4567-e89b-42d3-a456-426614174000',
    };
    const { rerender } = render(<ComplianceWorkflowWidget {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Verify Receipt' }));
    expect(await screen.findByRole('button', { name: 'Sign Receipt' })).toBeEnabled();
    expect(useTemplateQuery).toHaveBeenCalledWith(FORM_ID.ASSET_TRANSFER_RECEIPT);

    vi.mocked(useSignPdf).mockReturnValue({
      signPdf: mockSignPdf,
      isSigning: false,
      isSigned: true,
      error: null,
      resetSigningState: mockResetSigningState,
    });
    rerender(<ComplianceWorkflowWidget {...props} />);
    expect(screen.getByRole('button', { name: 'Signed' })).toBeDisabled();
  });

  it('opens signature overlay and executes signing flow successfully', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByText('Authorize Transfer'));

    await waitFor(() => {
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-pdf-url');
    });

    fireEvent.click(screen.getByText('Sign Authorization'));
    expect(screen.getByTestId('mock-signature-overlay')).toBeDefined();

    fireEvent.click(screen.getByTestId('mock-sign-submit'));

    await waitFor(() => {
      expect(mockSignPdf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-signed-pdf-url');
      expect(screen.getByRole('status')).toHaveTextContent('topology update pending');
    });
  });

  it('invalidates host-supplied query prefixes on save and application after a selection change', async () => {
    const onDocumentSaved = vi.fn();
    const onTopologyApplied = vi.fn();
    const graphKey = ['topology-service', 'graph', 'another-profile', {}];
    const otherKey = ['other-service', 'records', 'profile'];
    const unrelatedKey = ['unrelated'];
    const invalidateQueryKeys = [['topology-service', 'graph'], ['other-service', 'records']] as const;
    queryClient.setQueryData(graphKey, { nodes: [] });
    queryClient.setQueryData(otherKey, []);
    queryClient.setQueryData(unrelatedKey, []);
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} invalidateQueryKeys={invalidateQueryKeys} onDocumentSaved={onDocumentSaved} onTopologyApplied={onTopologyApplied} />);
    fireEvent.click(screen.getByText('Authorize Transfer'));
    await waitFor(() => expect(screen.getByText('Sign Authorization')).toBeDefined());
    fireEvent.click(screen.getByText('Sign Authorization'));
    fireEvent.click(screen.getByTestId('mock-sign-submit'));
    await waitFor(() => expect(onDocumentSaved).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(graphKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
    expect(onTopologyApplied).not.toHaveBeenCalled();

    queryClient.setQueryData(graphKey, { nodes: ['before-application'] });
    queryClient.setQueryData(otherKey, []);
    session.synchronizationStatus = 'ATTENTION_REQUIRED';
    rerender(<ComplianceWorkflowWidget {...defaultProps} assets={[]} invalidateQueryKeys={invalidateQueryKeys} onDocumentSaved={onDocumentSaved} onTopologyApplied={onTopologyApplied} />);
    expect(onTopologyApplied).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(graphKey)?.isInvalidated).toBe(false);

    session.synchronizationStatus = 'APPLIED';
    rerender(<ComplianceWorkflowWidget {...defaultProps} assets={[]} invalidateQueryKeys={invalidateQueryKeys} onDocumentSaved={onDocumentSaved} onTopologyApplied={onTopologyApplied} />);
    await waitFor(() => expect(onTopologyApplied).toHaveBeenCalledWith(onDocumentSaved.mock.calls[0][0]));
    expect(onTopologyApplied).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(graphKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });

  it('does not invalidate unrelated queries when no keys are supplied', async () => {
    const key = ['topology-service', 'graph', 'profile'];
    queryClient.setQueryData(key, []);
    const onDocumentSaved = vi.fn();
    const onTopologyApplied = vi.fn();
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} onDocumentSaved={onDocumentSaved} onTopologyApplied={onTopologyApplied} />);
    fireEvent.click(screen.getByText('Authorize Transfer'));
    await waitFor(() => expect(screen.getByText('Sign Authorization')).toBeDefined());
    fireEvent.click(screen.getByText('Sign Authorization'));
    fireEvent.click(screen.getByTestId('mock-sign-submit'));
    await waitFor(() => expect(onDocumentSaved).toHaveBeenCalled());
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    session.synchronizationStatus = 'APPLIED';
    rerender(<ComplianceWorkflowWidget {...defaultProps} onDocumentSaved={onDocumentSaved} onTopologyApplied={onTopologyApplied} />);
    await waitFor(() => expect(onTopologyApplied).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it('disables Authorize Transfer when no template is selected', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} template={undefined} />);

    expect(screen.getByText('Authorize Transfer').closest('button')).toBeDisabled();
  });

  it('disables Authorize Transfer until both organizations and an asset are provided', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} targetOrg={undefined} />);

    expect(screen.getByText('Authorize Transfer').closest('button')).toBeDisabled();
  });
});
