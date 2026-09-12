import { render, screen, fireEvent } from '@testing-library/react';
import SignatureOverlay from './SignatureOverlay';

describe('SignatureOverlay Unit Tests', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  const mockCtx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Canvas API for JSDOM
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100,
    } as DOMRect));
    
    // Mock offset properties
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 100 });
  });

  it('renders correctly with disabled actions initially', () => {
    render(<SignatureOverlay pdfBlobUrl="mock-url" onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    expect(screen.getByText('Sign here using your mouse or touch screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit & Sign PDF' })).toBeDisabled();
  });

  it('enables actions and hides placeholder after drawing', () => {
    render(<SignatureOverlay pdfBlobUrl="mock-url" onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    const canvas = document.querySelector('canvas')!;
    
    // Simulate drawing
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    
    expect(screen.queryByText('Sign here using your mouse or touch screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit & Sign PDF' })).toBeEnabled();
  });

  it('clears the canvas and disables actions when Clear is clicked', () => {
    render(<SignatureOverlay pdfBlobUrl="mock-url" onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    const canvas = document.querySelector('canvas')!;
    
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(clearBtn);

    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });
});