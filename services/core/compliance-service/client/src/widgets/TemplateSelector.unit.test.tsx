// File: services/core/compliance-service/client/src/widgets/TemplateSelector.unit.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import TemplateSelector from './TemplateSelector';

describe('TemplateSelector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches manifest and auto-selects the first template on mount', async () => {
    const mockManifest = [
      { id: 'dd-1149', name: 'DD-1149 Form' },
      { id: 'dd-250', name: 'DD-250 Form' },
    ];

    // Mock the initial manifest fetch
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    // Mock the subsequent HTML fetch triggered by the auto-select
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>DD-1149 Mock HTML</body></html>',
    } as Response);

    const handleTemplateLoad = vi.fn();

    render(
      <TemplateSelector
        label="Compliance Form"
        onTemplateLoad={handleTemplateLoad}
      />
    );

    // Wait for the dropdown to render the options
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: 'DD-1149 Form' })).toBeInTheDocument();
    
    // Verify the HTML payload was fetched and passed up to the shell
    await waitFor(() => {
      expect(handleTemplateLoad).toHaveBeenCalledWith('dd-1149', '<html><body>DD-1149 Mock HTML</body></html>');
    });
  });

  it('fetches new HTML when the user selects a different option', async () => {
    const mockManifest = [
      { id: 'dd-1149', name: 'DD-1149 Form' },
      { id: 'dd-250', name: 'DD-250 Form' },
    ];

    // 1. Manifest
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);
    // 2. Initial auto-select HTML
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>DD-1149 Mock HTML</body></html>',
    } as Response);

    const handleTemplateLoad = vi.fn();

    render(
      <TemplateSelector
        label="Compliance Form"
        onTemplateLoad={handleTemplateLoad}
      />
    );

    const selectElement = await screen.findByRole('combobox');
    
    // 3. User selects DD-250, mock the new HTML response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>DD-250 Mock HTML</body></html>',
    } as Response);

    await userEvent.selectOptions(selectElement, 'dd-250');

    await waitFor(() => {
      expect(handleTemplateLoad).toHaveBeenCalledWith('dd-250', '<html><body>DD-250 Mock HTML</body></html>');
    });
  });

  it('renders error state gracefully if manifest fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(<TemplateSelector onTemplateLoad={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to fetch templates/)).toBeInTheDocument();
    });
  });
});