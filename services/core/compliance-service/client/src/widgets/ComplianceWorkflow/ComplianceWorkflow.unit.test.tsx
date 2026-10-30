import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { z } from 'zod';
import { ComplianceWorkflowWidgetPropsSchema } from '@contracts/compliance';
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

// Shared with the TemplateSelector mock, which can't close over variables created after hoisting
const selectorMock = vi.hoisted(() => ({
  template: undefined as unknown,
  lastProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../components', () => ({
  TemplateSelector: (props: any) => {
    selectorMock.lastProps = props;
    return (
      <div>
        <label>{props.label}</label>
        <button data-testid="mock-selector-trigger" onClick={() => props.onSelect(selectorMock.template)}>
          Select Template
        </button>
      </div>
    );
  },
}));

describe('ComplianceWorkflowWidget', () => {
  const mockGeneratePdf = vi.fn(async ({ onSuccess }: { onSuccess: (blobUrl: string) => void }): Promise<void> => {
    onSuccess('blob:mock-pdf-url');
  });
  const mockOnSelect = vi.fn();

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
    selectorMock.template = template;
    
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

  // Optional entities are sampled independently so the fixture always has both orgs and an asset
  const sampleProps = () => {
    for (let seed = 1; seed < 50; seed++) {
      const generated = mockFromSchema(ComplianceWorkflowWidgetPropsSchema, {}, { seed });
      if (generated.sourceOrg && generated.targetOrg && generated.assets.length > 0) return generated;
    }
    throw new Error('Could not generate populated widget props');
  };
  const { transferType: _ignored, ...populated } = sampleProps();
  const defaultProps = { ...populated, onSelect: mockOnSelect };

  it('renders successfully and handles template selection and PDF generation workflow', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    expect(screen.getByText('Compliance Form')).toBeDefined();
    
    // Select a template via mock component trigger
    fireEvent.click(screen.getByTestId('mock-selector-trigger'));
    expect(mockOnSelect).toHaveBeenCalledWith(template.transferType);

    const generateBtn = screen.getByText('Generate PDF');
    expect(generateBtn).not.toHaveProperty('disabled', true);

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ id: template.id }),
          payloadData: expect.objectContaining({
            sourceOrg: expect.objectContaining({ id: defaultProps.sourceOrg?.id }),
            targetOrg: expect.objectContaining({ id: defaultProps.targetOrg?.id }),
          }),
          onSuccess: expect.any(Function),
        })
      );
    });

    const viewer = screen.getByTestId('document-viewer');
    expect(viewer.getAttribute('data-content')).toBe('blob:mock-pdf-url');
  });

  it('opens signature overlay and executes signing flow successfully', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    // Select template and generate PDF first
    fireEvent.click(screen.getByTestId('mock-selector-trigger'));
    fireEvent.click(screen.getByText('Generate PDF'));

    await waitFor(() => {
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-pdf-url');
    });

    // Click 'Sign Document' button to open overlay
    fireEvent.click(screen.getByText('Sign Document'));
    expect(screen.getByTestId('mock-signature-overlay')).toBeDefined();

    // Trigger signature submit
    fireEvent.click(screen.getByTestId('mock-sign-submit'));

    await waitFor(() => {
      expect(mockSignPdf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-signed-pdf-url');
    });
  });

  it('narrows the template selector by the transferType supplied by the host shell', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} transferType="C2_TRANSFER" />);

    expect(selectorMock.lastProps).toMatchObject({ typeFilter: 'AUTHORIZATION', transferTypeFilter: 'C2_TRANSFER' });
  });

  it('reports undefined to the host when the template is deselected', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    selectorMock.template = undefined;
    fireEvent.click(screen.getByTestId('mock-selector-trigger'));

    expect(mockOnSelect).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('Generate PDF').closest('button')).toBeDisabled();
  });
});
