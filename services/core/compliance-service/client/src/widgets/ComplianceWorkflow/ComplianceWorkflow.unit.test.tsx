import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { z } from 'zod';
import { signDocumentApiRequestSchema, templateDTOSchema, type TemplateDTOwithPayloadSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';
import { useGeneratePdf, useSignPdf } from '../../hooks';

// Mock the custom compliance hooks
vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useGeneratePdf: vi.fn(),
    useSignPdf: vi.fn(),
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
    hydrateTemplate: vi.fn((html, data) => `hydrated:${html}:${JSON.stringify(data)}`),
    DocumentViewer: ({ content, children }: any) => (
      <div data-testid="document-viewer" data-content={content}>
        {content}
        {children}
      </div>
    ),
  };
});

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
