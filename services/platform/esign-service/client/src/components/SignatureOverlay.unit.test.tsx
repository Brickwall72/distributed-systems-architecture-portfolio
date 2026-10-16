// File: services/platform/esignature-service/client/src/components/SignatureOverlay.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureOverlay from './SignatureOverlay';

describe('SignatureOverlay Unit Tests', () => {
  const mockOnSign = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    documentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    onSign: mockOnSign,
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

  it('handles drawing and successfully invokes onSign callback', async () => {
    mockOnSign.mockResolvedValueOnce(undefined);

    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & Sign PDF' }));

    await waitFor(() => {
      expect(mockOnSign).toHaveBeenCalledWith('data:image/png;base64,mockSignatureData');
    });
  });

  it('displays structured error message when onSign callback rejects', async () => {
    mockOnSign.mockRejectedValueOnce(
      new Error('Signature Processing Pipeline Failure')
    );

    render(<SignatureOverlay {...defaultProps} />);
    const canvas = document.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & Sign PDF' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Signature Processing Pipeline Failure');
    });
  });
});