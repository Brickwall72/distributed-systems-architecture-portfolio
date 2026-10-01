// File: services/core/compliance-service/client/src/widgets/DocumentsTable.unit.test.tsx
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';

describe('DocumentsTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Schema-compliant dataset (valid UUID v4 and status enum)
  const mockDocuments = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      document_type: 'DD-1149',
      s3_uri: 's3://compliance-vault/2026/dd1149.pdf',
      status: 'Approved',
      created_at: '2026-09-15T14:32:00Z',
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      document_type: 'DD-250',
      s3_uri: 's3://compliance-vault/2026/dd250.pdf',
      status: 'Pending',
      created_at: '2026-09-28T09:15:00Z',
    },
  ];

  it('renders initial database twin query loading state', () => {
    // Keep fetch pending indefinitely
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    render(createElement(DocumentsTable));

    expect(screen.getByText(/Querying compliance-db database twin\.\.\./i)).toBeInTheDocument();
  });

  it('fetches compliance documents, validates schema, and renders dataset', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    } as Response);

    render(createElement(DocumentsTable));

    // Wait for loading pulse to disappear and table to render
    await waitFor(() => {
      expect(screen.getByText('2 Records Loaded')).toBeInTheDocument();
    });

    expect(screen.getByText('Compliance Database Twin')).toBeInTheDocument();
    expect(screen.getByText('DD-1149')).toBeInTheDocument();
    expect(screen.getByText('DD-250')).toBeInTheDocument();

    // Verify S3 storage path rendered with custom column formatting
    const s3Cell = screen.getByText('s3://compliance-vault/2026/dd1149.pdf');
    expect(s3Cell).toHaveClass('font-mono', 'text-xs', 'text-blue-400');

    // Verify created_at rendered formatted locale date
    const expectedDate = new Date('2026-09-15T14:32:00Z').toLocaleString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('renders error UI when API returns HTTP error status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Failed to fetch documents dataset: 500 Internal Server Error')
    ).toBeInTheDocument();
  });

  it('renders error UI when backend payload violates Zod schema contract', async () => {
    // Malformed document payload (invalid UUID and invalid status string)
    const corruptData = [
      {
        id: 'non-uuid-string',
        document_type: 'DD-1149',
        s3_uri: 's3://vault/bad.pdf',
        status: 'INVALID_STATUS',
        created_at: 'invalid-date',
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => corruptData,
    } as Response);

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    // Zod throw will be caught and error message captured
    expect(screen.getByText(/Invalid UUID/i)).toBeInTheDocument();
  });
});