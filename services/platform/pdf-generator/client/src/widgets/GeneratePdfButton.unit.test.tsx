// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.test.tsx
import 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GeneratePdfButton from './GeneratePdfButton';

describe('GeneratePdfButton Component', () => {
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-blob');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('renders default text and is disabled if no payload is provided', () => {
    const { rerender } = render(<GeneratePdfButton htmlPayload="" />);
    const button = screen.getByRole('button', { name: 'Generate PDF' });
    
    expect(button).toBeDisabled();

    rerender(<GeneratePdfButton htmlPayload="<p>Valid</p>" />);
    expect(button).not.toBeDisabled();
  });

  it('successfully fetches PDF, creates blob, and fires onSuccess', async () => {
    const mockSuccessCb = vi.fn();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['pdf-data'], { type: 'application/pdf' }),
    });

    // 1. Render first so React Testing Library can safely mount to document.body
    render(<GeneratePdfButton htmlPayload="<h1>Test</h1>" onSuccess={mockSuccessCb} />);

    // 2. Setup the DOM spies *after* initial render
    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick, remove: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    
    // Mock appendChild without assigning to an unused variable
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as any);

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/pdf/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ html: '<h1>Test</h1>' }),
      }));

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('document.pdf');
      expect(mockClick).toHaveBeenCalled();
      expect(mockSuccessCb).toHaveBeenCalledWith('blob:http://localhost/test-blob');
    });
  });

  it('fires onError when the API request fails', async () => {
    const mockErrorCb = vi.fn();
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    render(<GeneratePdfButton htmlPayload="<h1>Test</h1>" onError={mockErrorCb} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Generate PDF' }));

    await waitFor(() => {
      expect(mockErrorCb).toHaveBeenCalledWith(new Error('Failed to generate PDF: Internal Server Error'));
    });
    
    // Ensure button returns to default state
    expect(screen.getByRole('button', { name: 'Generate PDF' })).not.toBeDisabled();
  });
});