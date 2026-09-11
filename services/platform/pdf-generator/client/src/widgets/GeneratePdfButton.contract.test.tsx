// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.contract.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import GeneratePdfButton from './GeneratePdfButton';

const { like } = MatchersV3;

const provider = new PactV3({
  consumer: 'pdf-client',
  provider: 'pdf-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('GeneratePdfButton Consumer Contract', () => {
  beforeAll(() => {
    // URL.createObjectURL doesn't exist in happy-dom, so we mock it to return a dummy string
    Object.defineProperty(global.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:http://localhost/mock-blob-url'),
    });
  });

  it('generates a valid contract for requesting PDF generation', async () => {
    provider
      .given('the pdf generator engine is healthy')
      .uponReceiving('a valid HTML payload to convert')
      .withRequest({
        method: 'POST',
        path: '/api/v1/pdf/generate',
        headers: { 'Content-Type': 'application/json' },
        body: {
          html: like('<h1>Test Transfer Document (DD-1149)</h1>'),
        },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
        // A minimal string simulating the header of a raw binary PDF file
        body: '%PDF-1.4\n%MockBinaryData', 
      });

    await provider.executeTest(async (mockServer) => {
      const originalFetch = global.fetch;
      
      // Override fetch to route requests to the Pact mock server
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = typeof input === 'string' ? input : input.toString();
        const targetUrl = urlString.startsWith('/') 
          ? `${mockServer.url}${urlString}` 
          : urlString;
          
        return originalFetch(targetUrl, init);
      };

      try {
        const handleSuccess = vi.fn();

        render(
          <GeneratePdfButton 
            htmlPayload="<h1>Test Transfer Document (DD-1149)</h1>" 
            onSuccess={handleSuccess} 
          />
        );

        // 1. Find the button and trigger the POST request
        const button = screen.getByRole('button', { name: /generate pdf/i });
        fireEvent.click(button);

        // 2. Verify the loading state engages
        expect(screen.getByRole('button', { name: /generating/i })).toBeInTheDocument();

        // 3. Wait for the fetch to resolve, the blob to be parsed, and onSuccess to fire
        await waitFor(() => {
          expect(handleSuccess).toHaveBeenCalledWith('blob:http://localhost/mock-blob-url');
        });
        
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});