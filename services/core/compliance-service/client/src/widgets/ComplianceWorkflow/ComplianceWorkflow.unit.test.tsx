// File: services/platform/compliance/client/src/widgets/ComplianceWorkflow/ComplianceWorkflow.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { ComplianceWorkflowWidgetParsedProps } from '@contracts/compliance';

// 1. Mock usePdfGenerator hook from pdf-client
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

// Mock TemplateSelector component cleanly emitting TemplateDTO
vi.mock('../../components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components')>();
  return {
    ...actual,
    TemplateSelector: ({ label, onTemplateLoad }: any) => (
      <div data-testid="mock-template-selector">
        <span>{label ?? 'Template Select'}</span>
        <button
          data-testid="mock-template-selector-btn"
          onClick={() =>
            onTemplateLoad?.({
              id: 'dd-1149',
              name: 'DD Form 1149',
              type: 'AUTHORIZATION',
              rawHTML: '<h1>Test</h1>',
            })
          }
        >
          Select Template
        </button>
      </div>
    ),
  };
});

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
  const defaultProps: ComplianceWorkflowWidgetParsedProps = {
    sourceOrg: { id: 'sourceOrg id', name: 'sourceOrg name', type: 'GOV' },
    assets: [
      {
        id: 'assets id',
        name: 'assets name',
        nomenclature: 'assets nomenclature',
        serialNumber: 'assets serial number',
      },
    ],
    targetOrg: { id: 'target id', name: 'target name', type: 'GOV' },
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

    fireEvent.click(screen.getByTestId('mock-template-selector-btn'));

    expect(screen.getByTestId('viewer-content')).toHaveTextContent('<h1>Test</h1>');

    const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it('transitions to PDF view when PDF generation succeeds', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector-btn'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(mockGenerate).toHaveBeenCalledWith('<h1>Test</h1>');

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

    fireEvent.click(screen.getByTestId('mock-template-selector-btn'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    const backBtn = screen.getByRole('button', { name: /back to interactive view/i });
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);

    const viewer = screen.getByTestId('mock-document-viewer');
    expect(viewer).toHaveAttribute('data-content-type', 'html');
    expect(screen.getByTestId('viewer-content')).toHaveTextContent('<h1>Test</h1>');
  });

  it('handles cancelling signature overlay without completing workflow', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector-btn'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    fireEvent.click(screen.getByRole('button', { name: /sign document/i }));
    expect(screen.getByTestId('mock-signature-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-sign-cancel-btn'));

    expect(screen.queryByTestId('mock-signature-overlay')).not.toBeInTheDocument();
  });

  it('handles e-signature modal lifecycle and triggers onWorkflowComplete', () => {
    render(<ComplianceWorkflowWidget {...defaultProps} />);

    fireEvent.click(screen.getByTestId('mock-template-selector-btn'));
    fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

    fireEvent.click(screen.getByRole('button', { name: /sign document/i }));
    expect(screen.getByTestId('mock-signature-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-sign-success-btn'));

    expect(screen.queryByTestId('mock-signature-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signed/i })).toBeDisabled();
  });
});