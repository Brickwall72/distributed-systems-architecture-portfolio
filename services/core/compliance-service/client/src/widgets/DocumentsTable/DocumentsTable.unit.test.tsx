// File: services/core/compliance-service/client/src/widgets/DocumentsTable.unit.test.tsx
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    getDocuments: vi.fn(),
  },
}));

describe('DocumentsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDocuments = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      documentType: 'asset-transfer-authorization' as const,
      storageBucket: 'compliance-vault',
      storageKey: '2026/dd1149.pdf',
      status: 'SIGNED' as const,
      createdAt: '2026-09-15T14:32:00.000Z',
      updatedAt: '2026-09-15T14:32:00.000Z',
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      documentType: 'asset-transfer-receipt' as const,
      storageBucket: 'compliance-vault',
      storageKey: '2026/dd250.pdf',
      status: 'PENDING_SIGNATURE' as const,
      createdAt: '2026-09-28T09:15:00.000Z',
      updatedAt: '2026-09-28T09:15:00.000Z',
    },
  ];

  it('renders initial database twin query loading state', () => {
    vi.mocked(apiClient.getDocuments).mockImplementation(() => new Promise(() => {}));

    render(createElement(DocumentsTable));

    expect(screen.getByText(/Querying compliance-db database twin\.\.\./i)).toBeInTheDocument();
  });

  it('fetches compliance documents, validates schema, and renders dataset', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: mockDocuments,
      headers: new Headers(),
    });

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('2 Records Loaded')).toBeInTheDocument();
    });

    expect(screen.getByText('Compliance Database Twin')).toBeInTheDocument();
    expect(screen.getByText('asset-transfer-authorization')).toBeInTheDocument();
    expect(screen.getByText('asset-transfer-receipt')).toBeInTheDocument();

    const s3Cell = screen.getByText('s3://compliance-vault/2026/dd1149.pdf');
    expect(s3Cell).toHaveClass('font-mono', 'text-xs', 'text-blue-400');

    const expectedDate = new Date('2026-09-15T14:32:00.000Z').toLocaleString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('renders error UI when API returns HTTP error status', async () => {
    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 500,
      body: { error: 'Internal Server Error' },
      headers: new Headers(),
    });

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
  });

  it('renders error UI when backend payload violates Zod schema contract', async () => {
    const corruptData = [
      {
        id: 'non-uuid-string',
        documentType: 'DD-1149',
        storageBucket: 'vault',
        storageKey: 'file.pdf',
        status: 'INVALID_STATUS',
        createdAt: 'invalid-date',
        updatedAt: 'invalid-date',
      },
    ];

    vi.mocked(apiClient.getDocuments).mockResolvedValueOnce({
      status: 200,
      body: corruptData as unknown as typeof mockDocuments,
      headers: new Headers(),
    });

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    expect(screen.getByText(/Artifact ID must be a valid UUID/i)).toBeInTheDocument();
  });
});