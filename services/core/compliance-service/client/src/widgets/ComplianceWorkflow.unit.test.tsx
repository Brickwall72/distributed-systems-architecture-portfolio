// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ComplianceWorkflowWidget, { ComplianceWorkflowProps } from './ComplianceWorkflow';

// 1. Mock heavy/external client dependencies to isolate workflow logic
vi.mock('pdf-client', () => ({
  GeneratePdfButton: ({ onSuccess, htmlPayload }: any) => (
    <button
      data-testid="mock-pdf-button"
      onClick={() => onSuccess('blob:http://localhost/mock-pdf-url')}
    >
      Generate PDF ({htmlPayload ? 'has-payload' : 'empty-payload'})
    </button>
  ),
}));

vi.mock('esign-client', () => ({
  SignatureOverlay: ({ onSuccess, onCancel }: any) => (
    <div data-testid="mock-signature-overlay">
      <button
        data-testid="mock-sign-success-btn"
        onClick={() => onSuccess('blob:http://localhost/mock-signed-pdf-url')}
      >
        Complete Signature
      </button>
      <button data-testid="mock-sign-cancel-btn" onClick={onCancel}>
        Cancel Signature
      </button>
    </div>
  ),
}));

vi.mock('./TemplateSelector', () => ({
  default: ({ onTemplateLoad }: any) => (
    <button
      data-testid="mock-template-selector"
      onClick={() => onTemplateLoad('dd-1149', '<h1>Requisition {{requisitionNumber}}</h1>')}
    >
      Select DD-1149
    </button>
  ),
}));

vi.mock('@shared/ui-components', () => ({
  DocumentViewer: ({ children, content, contentType }: any) => (
    <div data-testid="mock-document-viewer" data-content-type={contentType}>
      <div data-testid="viewer-content">{content}</div>
      {children}
    </div>
  ),
  hydrateTemplate: (html: string, data: Record<string, unknown>) =>
    html.replace('{{requisitionNumber}}', String(data.requisitionNumber ?? '')),
}));

describe('ComplianceWorkflowWidget', () => {
  const defaultProps: ComplianceWorkflowProps = {
    templateData: { requisitionNumber: 'REQ-2026-001' },
    documentId: 'doc-uuid-123',
    requisitionNumber: 'REQ-2026-001',
    signerId: 'usr_compliance_officer',
    entityId: 'org_001',
    onWorkflowComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unhydrated state before template selection', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    // Document viewer should render empty/raw state initially
    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'html');
    
    // Sign button disabled because PDF isn't generated yet
    const signBtn = screen.getByRole('button', { name: /sign document/i });
    expect(signBtn).toBeDisabled();
  });

  it('hydrates template HTML when a template is selected', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    // Simulate TemplateSelector returning raw HTML template
    fireEvent.click(screen.getByTestId('mock-template-selector'));

    // Verify hydrated output rendered into DocumentViewer
    expect(screen.getByTestId('viewer-content')).toHaveTextContent(
      '<h1>Requisition REQ-2026-001</h1>'
    );
  });

  it('transitions to PDF view when PDF generation succeeds', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    // Select template first
    fireEvent.click(screen.getByTestId('mock-template-selector'));

    // Trigger mocked PDF generation
    fireEvent.click(screen.getByTestId('mock-pdf-button'));

    // Viewer content type should switch to 'pdf' and display the blob URL
    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'pdf');
    expect(screen.getByTestId('viewer-content')).toHaveTextContent(
      'blob:http://localhost/mock-pdf-url'
    );

    // Sign button is now enabled
    const signBtn = screen.getByRole('button', { name: /sign document/i });
    expect(signBtn).not.toBeDisabled();
  });

  it('handles e-signature modal lifecycle and triggers onWorkflowComplete', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    // Complete pipeline up to PDF generation
    fireEvent.click(screen.getByTestId('mock-template-selector'));
    fireEvent.click(screen.getByTestId('mock-pdf-button'));

    // Click "Sign Document" to open overlay
    fireEvent.click(screen.getByRole('button', { name: /sign document/i }));
    expect(screen.getByTestId('mock-signature-overlay')).toBeInTheDocument();

    // Complete signature inside overlay
    fireEvent.click(screen.getByTestId('mock-sign-success-btn'));

    // Verify signature modal closes and signed state updates
    expect(screen.queryByTestId('mock-signature-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signed/i })).toBeDisabled();

    // Verify callback fired with signed URL payload
    expect(defaultProps.onWorkflowComplete).toHaveBeenCalledWith(
      'blob:http://localhost/mock-signed-pdf-url'
    );
  });
});