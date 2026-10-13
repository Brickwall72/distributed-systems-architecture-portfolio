// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { useCompliancePdf } from '../../hooks';

// Mock the custom compliance PDF hook
vi.mock('../../hooks', () => ({
  useCompliancePdf: vi.fn(),
}));

vi.mock('esign-client', () => ({
  SignatureOverlay: () => <div data-testid="mock-signature-overlay">Signature Overlay</div>,
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useCompliancePdf).mockReturnValue({
      generatePdf: mockGeneratePdf,
      isLoading: false,
      error: null,
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

    // Verify label rendered by TemplateSelector mock
    expect(screen.getByText('Compliance Form')).toBeDefined();
    
    // Select a template via mock component trigger
    fireEvent.click(screen.getByTestId('mock-selector-trigger'));

    // Verify template data is hydrated and "Generate PDF" becomes enabled
    const generateBtn = screen.getByText('Generate PDF');
    expect(generateBtn).not.toHaveProperty('disabled', true);

    // Click generate PDF
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'asset-transfer-authorization',
        }),
        expect.any(Function)
      );
    });

    // Verify document viewer receives the resulting blob URL
    const viewer = screen.getByTestId('document-viewer');
    expect(viewer.getAttribute('data-content')).toBe('blob:mock-pdf-url');
  });
});