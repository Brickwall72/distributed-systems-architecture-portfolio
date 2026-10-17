// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { useGeneratePdf, useSignPdf } from '../../hooks';

// Mock the custom compliance hooks
vi.mock('../../hooks', () => ({
  useGeneratePdf: vi.fn(),
  useSignPdf: vi.fn(),
}));

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

vi.mock('../../components', () => ({
  TemplateSelector: ({ label, onSelect }: any) => (
    <div>
      <label>{label}</label>
      <button
        data-testid="mock-selector-trigger"
        onClick={() =>
          onSelect({
            id: 'asset-transfer-authorization',
            name: 'Test Template',
            type: 'AUTHORIZATION',
            rawHTML: '<p>Hello {{requisitionNumber}}</p>',
          })
        }
      >
        Select Template
      </button>
    </div>
  ),
}));

describe('ComplianceWorkflowWidget', () => {
  const mockGeneratePdf = vi.fn(async (_params: any, onSuccess: (blobUrl: string) => void): Promise<void> => {
    onSuccess('blob:mock-pdf-url');
  });

  const mockSignPdf = vi.fn(async (_params: any, _sig: string, onSuccess: (blobUrl: string) => void): Promise<void> => {
    onSuccess('blob:mock-signed-pdf-url');
  });

  const mockResetSigningState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useGeneratePdf).mockReturnValue({
      generatePdf: mockGeneratePdf,
      isLoading: false,
      error: null,
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
    sourceOrg: { id: 'org-1', name: 'Source Alpha', type: 'GOV' as const },
    targetOrg: { id: 'org-2', name: 'Target Bravo', type: 'CONTRACTOR' as const },
    assets: [
      { id: 'ast-1', name: 'Widget Alpha', serialNumber: 'SN-12345', nomenclature: 'Test Asset' },
    ],
  };

  it('renders successfully and handles template selection and PDF generation workflow', async () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    expect(screen.getByText('Compliance Form')).toBeDefined();
    
    // Select a template via mock component trigger
    fireEvent.click(screen.getByTestId('mock-selector-trigger'));

    const generateBtn = screen.getByText('Generate PDF');
    expect(generateBtn).not.toHaveProperty('disabled', true);

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'asset-transfer-authorization',
        }),
        expect.any(Function)
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
      expect(mockSignPdf).toHaveBeenCalled();
      expect(screen.getByTestId('document-viewer').getAttribute('data-content')).toBe('blob:mock-signed-pdf-url');
    });
  });
});