import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';
import * as hooks from '../../hooks';
import { DocumentSchema } from 'compliance-shared';
import { mockFromSchema, setTestSession } from '@shared/testing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderTable = (element: React.ReactElement) => render(
  createElement(QueryClientProvider, { client: new QueryClient() }, element),
);

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof hooks>();
  return {
    ...actual,
    useDocuments: vi.fn(),
    useGetPdf: vi.fn(),
  };
});

describe('DocumentsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession();
    vi.mocked(hooks.useGetPdf).mockReturnValue({ data: undefined, error: null } as never);
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

    renderTable(createElement(DocumentsTable));

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

    renderTable(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('2 Records Loaded')).toBeInTheDocument();
    });

    expect(screen.getByText('Compliance Database Twin')).toBeInTheDocument();
    for (const doc of documents) {
      expect(screen.getByText(doc.requisitionNumber)).toBeInTheDocument();
      expect(screen.getByText(new Date(doc.updatedAt).toLocaleString())).toBeInTheDocument();
    }
  });

  it('passes status and requisition number filters to the documents hook', () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({ documents: [], loading: false, error: null, refetch: vi.fn() });

    renderTable(createElement(DocumentsTable, { statusFilter: ['IN_PROGRESS'], requisitionNumbers: ['REQ-1'] }));

    expect(hooks.useDocuments).toHaveBeenCalledWith({ statuses: ['IN_PROGRESS'], requisitionNumbers: ['REQ-1'] });
  });

  it('omits columns listed in hiddenColumns', () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({ documents: [], loading: false, error: null, refetch: vi.fn() });

    renderTable(createElement(DocumentsTable, { hiddenColumns: ['type'] }));

    expect(screen.queryByText('Document Type')).not.toBeInTheDocument();
    expect(screen.getByText('Transfer Type')).toBeInTheDocument();
  });

  it('renders error UI when hook returns an error state', async () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [],
      loading: false,
      error: 'Failed to fetch documents dataset: HTTP 500',
      refetch: vi.fn(),
    });

    renderTable(createElement(DocumentsTable));

    await waitFor(() => {
      expect(screen.getByText('Failed to load dataset view')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch documents dataset: HTTP 500')).toBeInTheDocument();
  });

  it('selects by document id even without a transfer and preserves selection callbacks', () => {
    const [first, second] = mockDocuments();
    first.transferEventId = null;
    second.transferEventId = null;
    second.requisitionNumber = first.requisitionNumber;
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [first, second], loading: false, error: null, refetch: vi.fn(),
    });
    const onPdfSelect = vi.fn();
    const onTransferEventSelect = vi.fn();
    const onRequisitionNumberSelect = vi.fn();
    renderTable(createElement(DocumentsTable, { onPdfSelect, onTransferEventSelect, onRequisitionNumberSelect }));

    const rows = screen.getAllByRole('row').slice(1);
    fireEvent.click(rows[0]);
    expect(onPdfSelect).toHaveBeenLastCalledWith({ type: 'select', documentId: first.id, identityId: 'usr_test' });
    expect(onTransferEventSelect).toHaveBeenLastCalledWith(undefined);
    expect(onRequisitionNumberSelect).toHaveBeenLastCalledWith(first.requisitionNumber);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(rows[1]);
    expect(onPdfSelect).toHaveBeenLastCalledWith({ type: 'select', documentId: second.id, identityId: 'usr_test' });
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(rows[1]);
    expect(onPdfSelect).toHaveBeenLastCalledWith({ type: 'clear' });
  });
});