import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';
import * as hooks from '../../hooks';
import { DocumentSchema } from 'compliance-shared';
import { mockFromSchema } from '@shared/testing';

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

  const mockDocuments = () => [
    mockFromSchema(DocumentSchema, { requisitionNumber: 'REQ-0001', updatedAt: '2026-09-15T14:32:00.000Z' }),
    mockFromSchema(DocumentSchema, { requisitionNumber: 'REQ-0002', updatedAt: '2026-09-28T09:15:00.000Z' }),
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
    const documents = mockDocuments();
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('2 Records Loaded')).toBeInTheDocument();
    });

    expect(screen.getByText('Compliance Database Twin')).toBeInTheDocument();
    for (const doc of documents) {
      expect(screen.getByText(doc.requisitionNumber)).toBeInTheDocument();
      expect(screen.getByText(new Date(doc.updatedAt).toLocaleString())).toBeInTheDocument();
    }
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