import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureOverlay from './SignatureOverlay';

describe('SignatureOverlay Contract Tests', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  let globalFetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 1. Mock Canvas methods
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      beginPath: vi.fn(), 
      moveTo: vi.fn(), 
      lineTo: vi.fn(), 
      stroke: vi.fn(),
    } as any));
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 } as any));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,MOCK_SIGNATURE_BASE_64');

    // 2. Mock FileReader using a proper class constructor to satisfy `new FileReader()`
    class MockFileReader {
      result = 'data:application/pdf;base64,MOCK_PDF_BASE_64';
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        if (this.onloadend) {
          this.onloadend();
        }
      }
    }
    global.FileReader = MockFileReader as any;

    // 3. Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mocked-signed-pdf-url');

    // 4. Mock Global Fetch to intercept both the PDF GET and API POST
    globalFetchMock = vi.fn(async (url: string) => {
      if (url === 'mock-pdf-url') {
        return { blob: async () => new Blob(['fake-pdf'], { type: 'application/pdf' }) };
      }
      
      if (url === '/api/v1/esign/') {
        return { 
          ok: true, 
          status: 200,
          blob: async () => new Blob(['signed-fake-pdf'], { type: 'application/pdf' }) 
        };
      }
      
      return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
    });
    
    global.fetch = globalFetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adheres to the /api/v1/esign/ API contract', async () => {
    render(<SignatureOverlay pdfBlobUrl="mock-pdf-url" onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    const canvas = document.querySelector('canvas')!;
    
    // Trigger signature state
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    
    // Submit payload
    const submitBtn = screen.getByRole('button', { name: 'Submit & Sign PDF' });
    fireEvent.click(submitBtn);

    // Wait for the async API flow to finish and call onSuccess
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('blob:mocked-signed-pdf-url');
    });

    // Extract the POST request call to validate the contract
    const apiCall = globalFetchMock.mock.calls.find((call: any[]) => call[0] === '/api/v1/esign/');
    
    expect(apiCall).toBeDefined();
    const requestOptions = apiCall[1];

    // Assert Headers Contract
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.headers).toHaveProperty('Content-Type', 'application/json');
    expect(requestOptions.headers).toHaveProperty('x-correlation-id');
    expect(requestOptions.headers['x-correlation-id']).toMatch(/^esign-req-\d+$/);

    // Assert Body Schema Contract
    const parsedBody = JSON.parse(requestOptions.body);
    expect(parsedBody).toEqual({
      pdfBase64: 'MOCK_PDF_BASE_64',
      signatureImageBase64: 'MOCK_SIGNATURE_BASE_64',
    });
  });
});