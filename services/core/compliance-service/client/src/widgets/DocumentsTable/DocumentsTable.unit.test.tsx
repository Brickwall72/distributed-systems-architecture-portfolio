// File: services/core/compliance-service/client/src/widgets/DocumentsTable.unit.test.tsx
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';
import * as hooks from '../../hooks';

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof hooks>();
  return {
    ...actual,
    useDocuments: vi.fn(),
  };
});

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
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(createElement(DocumentsTable));

    expect(screen.getByText(/Querying compliance-db database twin\.\.\./i)).toBeInTheDocument();
  });

  it('renders dataset when documents are successfully loaded via hook', async () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: mockDocuments,
      loading: false,
      error: null,
      refetch: vi.fn(),
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

  it('renders error UI when hook returns an error state', async () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [],
      loading: false,
      error: 'Failed to fetch documents dataset: HTTP 500',
      refetch: vi.fn(),
    });

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch documents dataset: HTTP 500')).toBeInTheDocument();
  });
});