// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('renders default button text and disables when payload is missing or empty', () => {
    const { rerender } = render(<GeneratePdfButton htmlPayload="" />);
    const button = screen.getByRole('button', { name: 'Generate PDF' });
    
    expect(button).toBeDisabled();

    rerender(<GeneratePdfButton htmlPayload="<p>DD-1149 Custody Manifest</p>" />);
    expect(button).not.toBeDisabled();
  });

  it('successfully fetches PDF, creates blob URL, and triggers fallback download', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['pdf-binary-data'], { type: 'application/pdf' }),
    });

    render(<GeneratePdfButton htmlPayload="<h1>Manifest</h1>" />);

    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick, remove: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as any);

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/pdf/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ html: '<h1>Manifest</h1>' }),
      }));

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('document.pdf');
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('invokes onSuccess callback with blobUrl when provided instead of downloading automatically', async () => {
    const mockSuccessCb = vi.fn();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['pdf-binary-data'], { type: 'application/pdf' }),
    });

    render(<GeneratePdfButton htmlPayload="<h1>Manifest</h1>" onSuccess={mockSuccessCb} />);

    const button = screen.getByRole('button', { name: 'Generate PDF' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSuccessCb).toHaveBeenCalledWith('blob:http://localhost/test-blob');
    });
  });

  it('fires onError callback and restores button state when API request fails', async () => {
    const mockErrorCb = vi.fn();
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    render(<GeneratePdfButton htmlPayload="<h1>Manifest</h1>" onError={mockErrorCb} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Generate PDF' }));

    await waitFor(() => {
      expect(mockErrorCb).toHaveBeenCalledWith(new Error('Failed to generate PDF: Internal Server Error'));
    });
    
    expect(screen.getByRole('button', { name: 'Generate PDF' })).not.toBeDisabled();
  });
});