// File: ui-shells/domain-shells/compliance-shell/src/pages/DocumentsPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { lazyRemote } from '../utils/federation';
import { FederatedErrorBoundary, DocumentViewer, useIdentity } from '@shared/ui-components';
import type { DocumentsTableInput, DocumentPreviewEvent } from '@contracts/compliance';

const DocumentsTable = lazyRemote<DocumentsTableInput>('compliance_client/DocumentsTable');
const TransfersTable = lazyRemote<{ onPdfSelect?: (event: DocumentPreviewEvent) => void }>('audit_client/TransfersTable');

type Source = 'document' | 'transfer';
type Preview =
  | { source: Source; documentId: string; identityId: string; status: 'loading' }
  | { source: Source; documentId: string; identityId: string; status: 'ready'; blob: Blob }
  | { source: Source; documentId: string; identityId: string; status: 'error'; message: string };

export default function DocumentsPage() {
  const identityId = useIdentity()?.id;
  const [preview, setPreview] = useState<Preview | null>(null);
  const activePreview = preview?.identityId === identityId ? preview : null;
  const blob = activePreview?.status === 'ready' ? activePreview.blob : undefined;
  const [objectUrl, setObjectUrl] = useState<{
    blob: Blob; url: string; source: Source; documentId: string; identityId: string; valid: boolean;
  } | null>(null);

  const handlePdfSelect = useCallback((source: Source, event: DocumentPreviewEvent) => {
    setPreview((current) => {
      if (event.type === 'clear') return current?.source === source ? null : current;
      if (event.type === 'select') {
        return { source, documentId: event.documentId, identityId: event.identityId, status: 'loading' };
      }
      if (current?.source !== source || current.documentId !== event.documentId || current.identityId !== event.identityId) return current;
      if (event.type === 'ready') {
        return { source, documentId: event.documentId, identityId: event.identityId, status: 'ready', blob: event.blob };
      }
      return { source, documentId: event.documentId, identityId: event.identityId, status: 'error', message: event.message };
    });
  }, []);
  const handleDocumentSelect = useCallback((event: DocumentPreviewEvent) => handlePdfSelect('document', event), [handlePdfSelect]);
  const handleTransferSelect = useCallback((event: DocumentPreviewEvent) => handlePdfSelect('transfer', event), [handlePdfSelect]);

  useEffect(() => {
    if (!blob || !activePreview) return;
    const url = URL.createObjectURL(blob);
    const entry = { blob, url, source: activePreview.source, documentId: activePreview.documentId, identityId: activePreview.identityId, valid: true };
    setObjectUrl(entry);
    return () => {
      entry.valid = false;
      URL.revokeObjectURL(url);
    };
  }, [blob, activePreview?.source, activePreview?.documentId, activePreview?.identityId]);

  const currentUrl = blob && objectUrl?.valid && objectUrl.blob === blob
    && objectUrl.source === activePreview?.source && objectUrl.documentId === activePreview?.documentId && objectUrl.identityId === activePreview.identityId
    ? objectUrl.url : undefined;

  let previewContent;
  if (activePreview?.status === 'loading') {
    previewContent = <output className="p-6 text-sm text-slate-400">Loading document...</output>;
  } else if (activePreview?.status === 'error') {
    previewContent = <p role="alert" className="p-6 text-sm text-red-300">Could not load document: {activePreview.message}</p>;
  } else {
    previewContent = <DocumentViewer content={currentUrl} contentType="pdf" title="Stored document" />;
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <section
        aria-label="Document preview"
        className="order-first flex h-[min(70vh,48rem)] min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-lg lg:order-last lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-slate-100">Document preview</h2>
          <p className="mt-1 text-sm text-slate-400">Select a document to review its PDF.</p>
        </div>
        <div className="relative min-h-0 flex-1">
          {previewContent}
        </div>
      </section>
      <div className="order-last min-w-0 space-y-6 lg:order-first">
        <section aria-label="Compliance documents" className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <FederatedErrorBoundary remoteName="DocumentsTable">
            <DocumentsTable onPdfSelect={handleDocumentSelect} />
          </FederatedErrorBoundary>
        </section>
        <section aria-label="Audit transfers" className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <FederatedErrorBoundary remoteName="TransfersTable">
            <TransfersTable onPdfSelect={handleTransferSelect} />
          </FederatedErrorBoundary>
        </section>
      </div>
    </div>
  );
}
