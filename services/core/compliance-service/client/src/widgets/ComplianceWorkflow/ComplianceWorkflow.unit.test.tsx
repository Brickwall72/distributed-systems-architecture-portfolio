// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow/ComplianceWorkflow.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ComplianceWorkflowWidget, { ComplianceWorkflowProps } from './ComplianceWorkflow';

// 1. Correctly mock usePdfGenerator hook from pdf-client
const mockGenerate = vi.fn();
let mockOnSuccessCallback: ((url: string) => void) | undefined;

vi.mock('pdf-client', () => ({
  usePdfGenerator: (options?: { onSuccess?: (url: string) => void }) => {
    mockOnSuccessCallback = options?.onSuccess;
    return {
      generate: mockGenerate.mockImplementation(() => {
        if (mockOnSuccessCallback) {
          mockOnSuccessCallback('blob:http://localhost/mock-pdf-url');
        }
      }),
      isGenerating: false,
      error: null,
    };
  },
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

// Match exact import path: ../TemplateSelector/TemplateSelector
vi.mock('../TemplateSelector/TemplateSelector', () => ({
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
  Button: ({ children, onClick, disabled, isLoading, variant, size, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || isLoading} {...props}>
      {children}
    </button>
  ),
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
    mockOnSuccessCallback = undefined;
  });

  it('renders unhydrated state before template selection', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'html');

    const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
    expect(generateBtn).toBeDisabled();

    const signBtn = screen.getByRole('button', { name: /sign document/i });
    expect(signBtn).toBeDisabled();
  });

  it('hydrates template HTML when a template is selected and enables PDF generation', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector'));

    expect(screen.getByTestId('viewer-content')).toHaveTextContent(
      '<h1>Requisition REQ-2026-001</h1>'
    );

    const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it('transitions to PDF view when PDF generation succeeds', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(mockGenerate).toHaveBeenCalledWith('<h1>Requisition REQ-2026-001</h1>');

    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'pdf');
    expect(screen.getByTestId('viewer-content')).toHaveTextContent(
      'blob:http://localhost/mock-pdf-url'
    );

    const signBtn = screen.getByRole('button', { name: /sign document/i });
    expect(signBtn).not.toBeDisabled();
  });

  it('allows toggling back to interactive view from PDF view', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    const backBtn = screen.getByRole('button', { name: /back to interactive view/i });
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);

    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'html');
    expect(screen.getByTestId('viewer-content')).toHaveTextContent(
      '<h1>Requisition REQ-2026-001</h1>'
    );
  });

  it('handles cancelling signature overlay without completing workflow', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    fireEvent.click(screen.getByRole('button', { name: /sign document/i }));
    expect(screen.getByTestId('mock-signature-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-sign-cancel-btn'));

    expect(screen.queryByTestId('mock-signature-overlay')).not.toBeInTheDocument();
    expect(defaultProps.onWorkflowComplete).not.toHaveBeenCalled();
  });

  it('handles e-signature modal lifecycle and triggers onWorkflowComplete', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    fireEvent.click(screen.getByRole('button', { name: /sign document/i }));
    expect(screen.getByTestId('mock-signature-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-sign-success-btn'));

    expect(screen.queryByTestId('mock-signature-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signed/i })).toBeDisabled();

    expect(defaultProps.onWorkflowComplete).toHaveBeenCalledWith(
      'blob:http://localhost/mock-signed-pdf-url'
    );
  });
});