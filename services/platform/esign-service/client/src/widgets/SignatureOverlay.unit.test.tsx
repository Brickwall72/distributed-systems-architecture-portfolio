// File: services/platform/esignature-service/client/src/widgets/SignatureOverlay.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureOverlay from './SignatureOverlay';
import { signDocument } from '../api';

vi.mock('../api/esignApi', () => ({
  signDocument: vi.fn(),
}));

describe('SignatureOverlay Unit Tests', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    pdfBlobUrl: 'blob:http://localhost/mock-pdf',
    documentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
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

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 100 });
  });

  it('renders correctly with disabled actions initially', () => {
    render(<SignatureOverlay {...defaultProps} />);

    expect(screen.getByText('Sign here using your mouse or touch screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit & Sign PDF' })).toBeDisabled();
  });

  it('handles full submission flow successfully', async () => {
    vi.mocked(signDocument).mockResolvedValueOnce('blob:http://localhost/signed-result-pdf');

    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & Sign PDF' }));

    await waitFor(() => {
      expect(signDocument).toHaveBeenCalledWith({
        pdfBlobUrl: defaultProps.pdfBlobUrl,
        signatureDataUrl: 'data:image/png;base64,mockSignatureData',
        documentId: defaultProps.documentId,
        signerId: defaultProps.signerId,
        entityId: defaultProps.entityId,
      });
      expect(mockOnSuccess).toHaveBeenCalledWith('blob:http://localhost/signed-result-pdf');
    });
  });

  it('displays structured error message when backend submission fails', async () => {
    vi.mocked(signDocument).mockRejectedValueOnce(
      new Error('Signature Verification Engine Failure')
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