// File: services/core/compliance-service/client/src/widgets/DocumentsTable/DocumentsTable.unit.test.tsx
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DocumentsTable from './DocumentsTable';
import * as hooks from '../../hooks';
import { DocumentListItemSchema } from 'compliance-shared';
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
    mockFromSchema(DocumentListItemSchema, { requisitionNumber: 'REQ-0001', updatedAt: '2026-09-15T14:32:00.000Z' }),
    mockFromSchema(DocumentListItemSchema, { requisitionNumber: 'REQ-0002', updatedAt: '2026-09-28T09:15:00.000Z' }),
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

    expect(screen.getByText('Compliance Documents')).toBeInTheDocument();
    for (const doc of documents) {
      expect(screen.getByText(doc.requisitionNumber)).toBeInTheDocument();
      expect(screen.getByText(new Date(doc.updatedAt).toLocaleString())).toBeInTheDocument();
    }
  });

  it('passes status and requisition number filters to the documents hook', () => {
    vi.mocked(hooks.useDocuments).mockReturnValue({ documents: [], loading: false, error: null, refetch: vi.fn() });

    renderTable(createElement(DocumentsTable, { statusFilter: ['IN_PROGRESS'], requisitionNumbers: ['REQ-1'] }));

    expect(hooks.useDocuments).toHaveBeenCalledWith({ statuses: ['IN_PROGRESS'], requisitionNumbers: ['REQ-1'], refreshKey: undefined });
  });

  it('only shows documents addressed to the current organization when requested', () => {
    const [incoming, outgoing] = mockDocuments();
    incoming.receiverOrgId = 'org-test';
    outgoing.receiverOrgId = 'org-other';
    const unknown = mockFromSchema(DocumentListItemSchema, { requisitionNumber: 'REQ-UNKNOWN', receiverOrgId: null });
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [incoming, outgoing, unknown], loading: false, error: null, refetch: vi.fn(),
    });
    const { rerender } = renderTable(createElement(DocumentsTable));
    expect(screen.getByText(outgoing.requisitionNumber)).toBeInTheDocument();
    rerender(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(DocumentsTable, { receivingOrganizationOnly: true })));
    expect(screen.getByText(incoming.requisitionNumber)).toBeInTheDocument();
    expect(screen.queryByText(outgoing.requisitionNumber)).not.toBeInTheDocument();
    expect(screen.queryByText(unknown.requisitionNumber)).not.toBeInTheDocument();
    expect(screen.getByText('1 Records Loaded')).toBeInTheDocument();
    expect(hooks.useDocuments).toHaveBeenLastCalledWith({ statuses: undefined, requisitionNumbers: undefined, refreshKey: undefined });
  });

  it('clears a selected transfer when it is no longer receivable', async () => {
    const [document] = mockDocuments();
    document.receiverOrgId = 'org-test';
    const onTransferEventSelect = vi.fn();
    const onRequisitionNumberSelect = vi.fn();
    const onAuthorizingTemplateSelect = vi.fn();
    const queryClient = new QueryClient();
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [document], loading: false, error: null, refetch: vi.fn(),
    });
    const table = () => createElement(QueryClientProvider, { client: queryClient },
      createElement(DocumentsTable, {
        receivingOrganizationOnly: true, onTransferEventSelect, onRequisitionNumberSelect, onAuthorizingTemplateSelect,
      }));
    const { rerender } = render(table());
    fireEvent.click(screen.getAllByRole('row')[1]);
    expect(onRequisitionNumberSelect).toHaveBeenLastCalledWith(document.requisitionNumber);
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [{ ...document, receiverOrgId: 'other-org' }], loading: false, error: null, refetch: vi.fn(),
    });
    rerender(table());
    await waitFor(() => expect(onRequisitionNumberSelect).toHaveBeenLastCalledWith(undefined));
    expect(onTransferEventSelect).toHaveBeenLastCalledWith(undefined);
    expect(onAuthorizingTemplateSelect).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByText(document.requisitionNumber)).not.toBeInTheDocument();
  });

  it('updates receivable documents when the profile organization changes or signs out', () => {
    const [incoming, outgoing] = mockDocuments();
    incoming.receiverOrgId = 'org-test';
    outgoing.receiverOrgId = 'org-other';
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [incoming, outgoing], loading: false, error: null, refetch: vi.fn(),
    });

    renderTable(createElement(DocumentsTable, { receivingOrganizationOnly: true }));
    expect(screen.getByText(incoming.requisitionNumber)).toBeInTheDocument();
    act(() => setTestSession('org-other'));
    expect(screen.queryByText(incoming.requisitionNumber)).not.toBeInTheDocument();
    expect(screen.getByText(outgoing.requisitionNumber)).toBeInTheDocument();
    act(() => setTestSession(null));
    expect(screen.queryByText(outgoing.requisitionNumber)).not.toBeInTheDocument();
  });

  it('keeps a partially received transfer selected and clears it when fully received', async () => {
    const [document] = mockDocuments();
    document.receiverOrgId = 'org-test';
    const onTransferEventSelect = vi.fn();
    const queryClient = new QueryClient();
    const table = () => createElement(QueryClientProvider, { client: queryClient },
      createElement(DocumentsTable, { receivingOrganizationOnly: true, onTransferEventSelect }));
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [document], loading: false, error: null, refetch: vi.fn(),
    });
    const { rerender } = render(table());
    fireEvent.click(screen.getAllByRole('row')[1]);
    onTransferEventSelect.mockClear();
    vi.mocked(hooks.useDocuments).mockReturnValue({
      documents: [{ ...document, status: 'PARTIALLY_COMPLETED' }], loading: false, error: null, refetch: vi.fn(),
    });
    rerender(table());
    expect(screen.getByText(document.requisitionNumber)).toBeInTheDocument();
    expect(onTransferEventSelect).not.toHaveBeenCalled();
    vi.mocked(hooks.useDocuments).mockReturnValue({ documents: [], loading: false, error: null, refetch: vi.fn() });
    rerender(table());
    await waitFor(() => expect(onTransferEventSelect).toHaveBeenCalledWith(undefined));
    expect(screen.queryByText(document.requisitionNumber)).not.toBeInTheDocument();
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