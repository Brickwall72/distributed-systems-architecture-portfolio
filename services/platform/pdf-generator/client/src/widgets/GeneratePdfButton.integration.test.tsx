// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GeneratePdfButton from './GeneratePdfButton';

// NOTE: This test requires the backend service container to be actively running on localhost:4001
describe('GeneratePdfButton <-> Backend Integration Matrix', () => {
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

  afterEach(() => {
    // Crucial: Restore all spies and mocks after each test so document.body and DOM methods reset cleanly
    vi.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('generates a real PDF and triggers fallback anchor download when no onSuccess handler is attached', async () => {
    const testHtml = '<div style="padding: 2rem;"><h1>Integration Test - Download Mode</h1></div>';

    render(
      <GeneratePdfButton 
        htmlPayload={testHtml} 
        fileName="live-integration-report.pdf"
      />
    );

    // Setup DOM spies for anchor creation and click
    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick, remove: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as any);

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generating...' })).toBeInTheDocument();

    // Wait for real container response and download trigger
    await waitFor(() => {
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('live-integration-report.pdf');
      expect(mockClick).toHaveBeenCalled();
    }, { timeout: 10000 });
  });

  it('generates a real PDF and invokes onSuccess callback without triggering download anchor', async () => {
    const mockSuccessCb = vi.fn();
    const testHtml = '<div style="padding: 2rem;"><h1>Integration Test - Callback Mode</h1></div>';

    render(
      <GeneratePdfButton 
        htmlPayload={testHtml} 
        onSuccess={mockSuccessCb}
      />
    );

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    // Wait for the real container to return the binary blob URL
    await waitFor(() => {
      expect(mockSuccessCb).toHaveBeenCalledWith('blob:http://localhost/integration-blob');
    }, { timeout: 10000 });
  });
});