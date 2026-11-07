// File: services/core/compliance-service/client/src/widgets/DocumentsTable.tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Document } from 'compliance-shared';
import { DatabaseTwinTable, TableColumn, useIdentity } from '@shared/ui-components';
import { DocumentsTableInput } from '@contracts/compliance';
import { useDocuments, useGetPdf } from '../../hooks';
import '@shared/styles';

const columns: TableColumn<Document>[] = [
  { key: 'requisitionNumber', header: 'Requisition Number' },
  { key: 'transferType', header: 'Transfer Type' },
  { key: 'type', header: 'Document Type' },
  { key: 'status', header: 'Status' },
  { 
    key: 'updatedAt', 
    header: 'Updated At',
    render: (val) => val ? new Date(String(val)).toLocaleString() : 'N/A'
  },
];

export default function DocumentsTable({
  onTransferEventSelect, onRequisitionNumberSelect, onAuthorizingTemplateSelect, onPdfSelect,
  statusFilter, requisitionNumbers, hiddenColumns
}: Readonly<DocumentsTableInput>) {
  const { documents, loading, error } = useDocuments({ statuses: statusFilter, requisitionNumbers });
  const identityId = useIdentity()?.id;
  const previousIdentityId = useRef(identityId);
  const queryClient = useQueryClient();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const { data: pdf, error: pdfError } = useGetPdf(
    onPdfSelect && previousIdentityId.current === identityId ? selectedDocumentId : undefined,
  );
  const selectable = onTransferEventSelect || onRequisitionNumberSelect || onAuthorizingTemplateSelect || onPdfSelect;

  useEffect(() => {
    if (previousIdentityId.current !== identityId) {
      const oldId = previousIdentityId.current;
      previousIdentityId.current = identityId;
      setSelectedDocumentId(undefined);
      onPdfSelect?.({ type: 'clear' });
      if (oldId) {
        queryClient.removeQueries({ queryKey: ['compliance-service', 'document-pdf', oldId] });
      }
    }
  }, [identityId, onPdfSelect, queryClient]);

  useEffect(() => {
    if (!selectedDocumentId || !identityId || !onPdfSelect) return;
    if (pdf) {
      onPdfSelect({ type: 'ready', documentId: selectedDocumentId, identityId, blob: pdf });
    } else if (pdfError) {
      onPdfSelect({ type: 'error', documentId: selectedDocumentId, identityId, message: pdfError.message });
    }
  }, [pdf, pdfError, selectedDocumentId, identityId, onPdfSelect]);

  const visibleColumns = hiddenColumns?.length
    ? columns.filter((column) => !(hiddenColumns as readonly string[]).includes(String(column.key)))
    : columns;

  const handleRowSelect = (row: Document) => {
    const nextId = row.id === selectedDocumentId ? undefined : row.id;
    setSelectedDocumentId(nextId);
    onTransferEventSelect?.(nextId ? row.transferEventId ?? undefined : undefined);
    onRequisitionNumberSelect?.(nextId ? row.requisitionNumber : undefined);
    onAuthorizingTemplateSelect?.(nextId ? row.name : undefined);
    if (nextId && identityId) {
      onPdfSelect?.({ type: 'select', documentId: nextId, identityId });
    } else {
      onPdfSelect?.({ type: 'clear' });
    }
  };

  if (loading) {
    return (
      <div className="text-slate-400 font-mono py-16 text-center animate-pulse">
        Querying compliance-db database twin...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-lg text-red-200 space-y-1">
        <h4 className="font-semibold text-sm">Failed to load dataset view</h4>
        <p className="text-xs text-red-300/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white tracking-wide">Compliance Database Twin</h3>
          <p className="text-sm text-slate-400">Read-only synchronized view of records in the PostgreSQL compliance ledger.</p>
        </div>
        <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 rounded-full shadow-sm">
          {documents.length} Records Loaded
        </span>
      </div>
      <DatabaseTwinTable 
        data={documents}
        columns={visibleColumns}
        rowKey="id"
        onRowSelect={selectable ? handleRowSelect : undefined}
        selectedRowKey={selectedDocumentId}
      />
    </div>
  );
}