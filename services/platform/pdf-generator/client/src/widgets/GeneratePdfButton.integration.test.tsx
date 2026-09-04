// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.integration.test.tsx
import 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GeneratePdfButton from './GeneratePdfButton';

// NOTE: This test requires the backend service container to be actively running on localhost:4001
describe('GeneratePdfButton <-> Backend Integration', () => {
  const originalFetch = global.fetch;
  const originalCreateObjectURL = URL.createObjectURL;

  beforeAll(() => {
    // 1. Route relative fetch calls to the real running backend container
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlString = typeof input === 'string' ? input : input.toString();
      const targetUrl = urlString.startsWith('/') 
        ? `http://localhost:4001${urlString}` 
        : urlString;
        
      return originalFetch(targetUrl, init);
    };

    // 2. Mock URL creation since JSDOM cannot handle real binary blob URLs
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/integration-blob');
  });

  afterAll(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    vi.restoreAllMocks();
  });

  it('generates a real PDF from the Express/Puppeteer backend', async () => {
    const mockSuccessCb = vi.fn();
    const mockErrorCb = vi.fn();
    
    const testHtml = '<div style="font-family: sans-serif; padding: 2rem; color: #333;"><h1 style="border-bottom: 2px solid #eaeaea; padding-bottom: 0.5rem;">Integration Test</h1><p>Testing real server container interaction.</p></div>';

    // 1. Render FIRST so React Testing Library successfully mounts to document.body
    render(
      <GeneratePdfButton 
        htmlPayload={testHtml} 
        fileName="live-integration-report.pdf"
        onSuccess={mockSuccessCb}
        onError={mockErrorCb}
      />
    );

    // 2. Setup DOM spies AFTER render for when the component triggers the download
    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick, remove: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as any);

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    // Verify loading state triggers
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generating...' })).toBeInTheDocument();

    // Wait for the real Docker container to spin up Puppeteer, render, and return the PDF.
    await waitFor(() => {
      expect(mockSuccessCb).toHaveBeenCalled();
    }, { timeout: 10000 });

    // Verify the successful outcome
    expect(mockErrorCb).not.toHaveBeenCalled();
    expect(mockAnchor.download).toBe('live-integration-report.pdf');
    expect(mockClick).toHaveBeenCalled();
  });
});