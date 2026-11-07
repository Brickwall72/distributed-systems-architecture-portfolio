import { act, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { setTestSession } from '@shared/testing';
import type { DocumentPreviewEvent, DocumentsTableInput } from '@contracts/compliance';
import DocumentsPage from './DocumentsPage';

const { loadRemote, remote } = vi.hoisted(() => ({
  loadRemote: vi.fn(),
  remote: { onPdfSelect: undefined as DocumentsTableInput['onPdfSelect'] },
}));

vi.mock('@module-federation/enhanced/runtime', () => ({ loadRemote }));
vi.mock('@shared/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/ui-components')>();
  return {
    ...actual,
    DocumentViewer: ({ content, title }: { content?: string | null; title?: string }) =>
      content ? <div title={title} data-url={content} /> : <div>No document loaded</div>,
  };
});

describe('DocumentsPage', () => {
  beforeEach(() => {
    setTestSession();
    loadRemote.mockImplementation(async (id: string) => ({
      default: (props: DocumentsTableInput) => {
        if (id === 'compliance_client/DocumentsTable') remote.onPdfSelect = props.onPdfSelect;
        return <div data-testid={id} />;
      },
    }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  const emit = (event: DocumentPreviewEvent) => act(() => remote.onPdfSelect?.(event));
  const renderPage = async () => {
    const result = render(<Suspense fallback={null}><DocumentsPage /></Suspense>);
    await screen.findByTestId('compliance_client/DocumentsTable');
    await screen.findByTestId('audit_client/TransfersTable');
    return result;
  };

  it('loads both remotes and displays an empty preview', async () => {
    await renderPage();
    expect(screen.getByText('No document loaded')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Document preview' })).toBeInTheDocument();
  });

  it('creates and revokes a page-owned URL and ignores late results', async () => {
    const { unmount } = await renderPage();
    const first = { documentId: 'first', identityId: 'usr_test' };
    const second = { documentId: 'second', identityId: 'usr_test' };
    const firstBlob = new Blob(['first'], { type: 'application/pdf' });
    const secondBlob = new Blob(['second'], { type: 'application/pdf' });
    emit({ type: 'select', ...first });
    expect(screen.getByRole('status')).toHaveTextContent('Loading document');
    emit({ type: 'select', ...second });
    emit({ type: 'ready', ...first, blob: firstBlob });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    emit({ type: 'ready', ...second, blob: secondBlob });
    await waitFor(() => expect(screen.getByTitle('Stored document')).toHaveAttribute('data-url', 'blob:preview'));
    expect(URL.createObjectURL).toHaveBeenCalledWith(secondBlob);
    emit({ type: 'clear' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(screen.getByText('No document loaded')).toBeInTheDocument();
    unmount();
  });

  it('hides the preview on sign-out and reports download errors', async () => {
    await renderPage();
    const selection = { documentId: 'first', identityId: 'usr_test' };
    emit({ type: 'select', ...selection });
    emit({ type: 'error', ...selection, message: 'HTTP 403' });
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 403');
    emit({ type: 'ready', ...selection, blob: new Blob(['pdf']) });
    await waitFor(() => expect(screen.getByTitle('Stored document')).toBeInTheDocument());
    act(() => setTestSession(null));
    expect(screen.queryByTitle('Stored document')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('creates a new URL when a cached blob is selected again', async () => {
    await renderPage();
    const selection = { documentId: 'first', identityId: 'usr_test' };
    const blob = new Blob(['pdf']);
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    emit({ type: 'select', ...selection });
    emit({ type: 'ready', ...selection, blob });
    await waitFor(() => expect(screen.getByTitle('Stored document')).toHaveAttribute('data-url', 'blob:first'));
    emit({ type: 'clear' });
    emit({ type: 'select', ...selection });
    emit({ type: 'ready', ...selection, blob });
    await waitFor(() => expect(screen.getByTitle('Stored document')).toHaveAttribute('data-url', 'blob:second'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('revokes the displayed URL when the page unmounts', async () => {
    const { unmount } = await renderPage();
    const selection = { documentId: 'first', identityId: 'usr_test' };
    emit({ type: 'select', ...selection });
    emit({ type: 'ready', ...selection, blob: new Blob(['pdf']) });
    await screen.findByTitle('Stored document');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
