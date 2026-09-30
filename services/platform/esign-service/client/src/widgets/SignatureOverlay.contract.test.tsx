// File: services/platform/esignature-service/client/src/widgets/SignatureOverlay.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureOverlay from './SignatureOverlay';

describe('SignatureOverlay Unit Tests', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    pdfBlobUrl: 'blob:http://localhost/mock-pdf',
    documentId: 'doc-uuid-1234',
    signerId: 'usr-actor-404',
    entityId: 'org-armory-01',
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
  };

  const mockCtx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTMLCanvasElement API for JSDOM
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => mockCtx as unknown as CanvasRenderingContext2D
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockSignatureData');
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Mock DOM Dimensions
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 100 });

    // Mock Browser URL globals
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://localhost/signed-result-pdf'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders correctly with disabled actions initially', () => {
    render(<SignatureOverlay {...defaultProps} />);

    expect(screen.getByText('Sign here using your mouse or touch screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit & Sign PDF' })).toBeDisabled();
  });

  it('enables actions and hides placeholder after drawing', () => {
    render(<SignatureOverlay {...defaultProps} />);

    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();

    expect(screen.queryByText('Sign here using your mouse or touch screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit & Sign PDF' })).toBeEnabled();
  });

  it('clears canvas and resets action buttons on Clear click', () => {
    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByText('Sign here using your mouse or touch screen')).toBeInTheDocument();
  });

  it('handles full submission flow successfully', async () => {
    const mockPdfBlob = new Blob(['%PDF-mock'], { type: 'application/pdf' });
    const mockSignedPdfBlob = new Blob(['%PDF-signed'], { type: 'application/pdf' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === defaultProps.pdfBlobUrl) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockPdfBlob),
          });
        }
        if (url === '/esign/api/v1/') {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockSignedPdfBlob),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      })
    );

    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & Sign PDF' }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('blob:http://localhost/signed-result-pdf');
    });
  });

  it('displays structured error message when backend submission fails', async () => {
    const mockPdfBlob = new Blob(['%PDF-mock'], { type: 'application/pdf' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === defaultProps.pdfBlobUrl) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockPdfBlob),
          });
        }
        if (url === '/esign/api/v1/') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Signature Verification Engine Failure' }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      })
    );

    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & Sign PDF' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Signature Verification Engine Failure');
    });
  });
});