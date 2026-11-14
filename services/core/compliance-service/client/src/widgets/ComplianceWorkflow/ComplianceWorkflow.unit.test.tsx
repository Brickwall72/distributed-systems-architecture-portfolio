// File: services/core/compliance-service/client/src/widgets/ComplianceWorkflow/ComplianceWorkflow.unit.test.tsx
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { z } from 'zod';
import { signDocumentApiRequestSchema, templateDTOSchema, type TemplateDTOwithPayloadSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { useGeneratePdf, useSignPdf } from '../../hooks';
import type { Identity } from '@contracts/auth';

const session = vi.hoisted(() => ({
  identity: { id: 'usr_ksc_gov', displayName: 'KSC', orgId: 'org-ksc-gov', roles: ['org-member'], signerId: 'usr_ksc_gov' } as Identity | null,
}));

// Mock the custom compliance hooks
vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useGeneratePdf: vi.fn(),
    useSignPdf: vi.fn(),
    useDocumentSync: vi.fn(() => ({ data: undefined, error: null })),
  };
});

vi.mock('esign-client', () => ({
  SignatureOverlay: ({ onSign, onCancel }: any) => (
    <div data-testid="mock-signature-overlay">
      <button data-testid="mock-sign-submit" onClick={() => onSign('data:image/png;base64,sig')}>
        Sign and Submit
      </button>
      <button data-testid="mock-sign-cancel" onClick={onCancel}>
        Cancel Sign
      </button>
    </div>
  ),
  signDocument: vi.fn(),
}));

vi.mock('@shared/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/ui-components')>();
  return {
    ...actual,
    useIdentity: () => session.identity,
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
    session.identity = { id: 'usr_ksc_gov', displayName: 'KSC', orgId: 'org-ksc-gov', roles: ['org-member'], signerId: 'usr_ksc_gov' };
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

    const generateBtn = screen.getByText('Generate PDF');
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
    fireEvent.click(screen.getByText('Generate PDF'));

    session.identity = { id: 'auditor', displayName: 'Auditor', orgId: null, roles: ['auditor'], signerId: 'auditor' };
    rerender(<ComplianceWorkflowWidget {...defaultProps} />);
    await act(async () => finish('blob:stale-preview'));

    expect(revoke).toHaveBeenCalledWith('blob:stale-preview');
    expect(screen.getByText('Generate PDF').closest('button')).toBeDisabled();
    expect(screen.getByTestId('document-viewer').getAttribute('data-content')).not.toBe('blob:stale-preview');
    revoke.mockRestore();
  });

  it('discards a late draft when the selected assets change', async () => {
    let finish!: (url: string) => void;
    mockGeneratePdf.mockImplementationOnce(async ({ onSuccess }) => { finish = onSuccess; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate PDF'));

    rerender(<ComplianceWorkflowWidget {...defaultProps} assets={[{ id: 'asset-2', nomenclature: 'Other', serialNumber: 'SN-2' }]} />);
    await act(async () => finish('blob:old-asset-draft'));

    expect(revoke).toHaveBeenCalledWith('blob:old-asset-draft');
    expect(screen.getByText('Generate PDF')).toBeDefined();
    expect(screen.queryByText('Sign Document')).toBeNull();
    revoke.mockRestore();
  });

  it('closes an existing draft when a counterparty changes', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = render(<ComplianceWorkflowWidget {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate PDF'));
    await waitFor(() => expect(screen.getByText('Sign Document')).toBeDefined());

    rerender(<ComplianceWorkflowWidget {...defaultProps} targetOrg={{ id: 'org-other', name: 'Other' }} />);

    expect(screen.queryByText('Sign Document')).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:mock-pdf-url');
    revoke.mockRestore();
  });

  it('swaps Generate PDF for Back to Interactive View and Sign Document once a PDF exists', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByText('Generate PDF'));

    await waitFor(() => expect(screen.getByText('Sign Document')).toBeDefined());
    expect(screen.queryByText('Generate PDF')).toBeNull();

    fireEvent.click(screen.getByText('Back to Interactive View'));

    expect(screen.getByText('Generate PDF')).toBeDefined();
    expect(screen.queryByText('Sign Document')).toBeNull();
    expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toContain('hydrated:');
  });

  it('opens signature overlay and executes signing flow successfully', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByText('Generate PDF'));

    await waitFor(() => {
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-pdf-url');
    });

    fireEvent.click(screen.getByText('Sign Document'));
    expect(screen.getByTestId('mock-signature-overlay')).toBeDefined();

    fireEvent.click(screen.getByTestId('mock-sign-submit'));

    await waitFor(() => {
      expect(mockSignPdf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-signed-pdf-url');
      expect(screen.getByRole('status')).toHaveTextContent('topology update pending');
    });
  });

  it('disables Generate PDF when no template is selected', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} template={undefined} />);

    expect(screen.getByText('Generate PDF').closest('button')).toBeDisabled();
  });

  it('disables Generate PDF until both organizations and an asset are provided', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} targetOrg={undefined} />);

    expect(screen.getByText('Generate PDF').closest('button')).toBeDisabled();
  });
});
