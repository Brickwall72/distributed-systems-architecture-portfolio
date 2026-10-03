// File: services/core/compliance-service/client/src/widgets/TemplateSelector/TemplateSelector.unit.test.tsx
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

  const mockManifest = [
    { id: 'dd-1149', name: 'DD-1149 Form' },
    { id: 'transfer-authorization', name: 'Transfer Authorization Form' },
  ];

  it('fetches manifest and auto-selects the first template on mount', async () => {
    // 1. Manifest response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    // 2. HTML content response for auto-selected template ('dd-1149')
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>DD-1149 Mock HTML Content</body></html>',
    } as Response);

    const handleTemplateLoad = vi.fn();

    render(
      <TemplateSelector
        label="Compliance Form"
        onTemplateLoad={handleTemplateLoad}
      />
    );

    // Verify combobox rendered with both options loaded
    const select = await screen.findByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DD-1149 Form' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Transfer Authorization Form' })
    ).toBeInTheDocument();

    // Verify callback was dispatched with template ID and fetched markup
    await waitFor(() => {
      expect(handleTemplateLoad).toHaveBeenCalledWith(
        'dd-1149',
        '<html><body>DD-1149 Mock HTML Content</body></html>'
      );
    });
  });

  it('fetches new HTML content when user selects a different template', async () => {
    // 1. Manifest
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    // 2. Initial auto-load content
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>DD-1149 Mock HTML Content</body></html>',
    } as Response);

    const handleTemplateLoad = vi.fn();

    render(
      <TemplateSelector
        label="Compliance Form"
        onTemplateLoad={handleTemplateLoad}
      />
    );

    const selectElement = await screen.findByRole('combobox');

    // 3. Content response for manual selection change
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>Transfer Auth Mock HTML Content</body></html>',
    } as Response);

    await userEvent.selectOptions(selectElement, 'transfer-authorization');

    await waitFor(() => {
      expect(handleTemplateLoad).toHaveBeenCalledWith(
        'transfer-authorization',
        '<html><body>Transfer Auth Mock HTML Content</body></html>'
      );
    });
  });

  it('renders error state when template manifest fetch returns HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    render(<TemplateSelector onTemplateLoad={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Error: Failed to fetch template manifest: 500 Internal Server Error'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders error state when backend manifest violates Zod schema contract', async () => {
    const corruptManifest = [{ invalid_field: 'missing_id_and_name' }];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => corruptManifest,
    } as Response);

    render(<TemplateSelector onTemplateLoad={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('renders error state when template content fetch fails', async () => {
    // 1. Manifest success
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    // 2. Content fetch failure
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    render(<TemplateSelector onTemplateLoad={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Error: Failed to fetch template content for 'dd-1149': 404 Not Found"
        )
      ).toBeInTheDocument();
    });
  });
});