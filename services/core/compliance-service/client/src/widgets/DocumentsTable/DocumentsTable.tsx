// File: services/core/compliance-service/client/src/widgets/DocumentsTable.tsx
import { useState } from 'react';
import { Document, DocumentStatus, FormId } from 'compliance-shared';
import { DatabaseTwinTable, TableColumn } from '@shared/ui-components';
import { useDocuments } from '../../hooks';
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

export interface DocumentsTableProps {
  /** Emits the selected row's transferEventId, or undefined when deselected. */
  readonly onTransferEventSelect?: (transferEventId: string | undefined) => void;
  readonly onRequisitionNumberSelect?: (requisitionNumber: string | undefined) => void;
  /** Emits the selected row's template id (the authorizing document), or undefined when deselected. */
  readonly onAuthorizingTemplateSelect?: (templateId: FormId | undefined) => void;
  /** Limits returned rows to these statuses (e.g. IN_PROGRESS, PARTIALLY_COMPLETED). */
  readonly statusFilter?: readonly DocumentStatus[];
  /** Limits returned rows (server-side) to these requisition numbers. */
  readonly requisitionNumbers?: readonly string[];
  /** Columns (by Document key) to omit from the table. */
  readonly hiddenColumns?: readonly (keyof Document)[];
}

export default function DocumentsTable({ onTransferEventSelect, onRequisitionNumberSelect, onAuthorizingTemplateSelect, statusFilter, requisitionNumbers, hiddenColumns }: Readonly<DocumentsTableProps>) {
  const { documents, loading, error } = useDocuments({ statuses: statusFilter, requisitionNumbers });
  const [selectedTransferEventId, setSelectedTransferEventId] = useState<string>();
  const [selectedRequisitionNumber, setSelectedRequisitionNumber] = useState<string>();

  const visibleColumns = hiddenColumns?.length
    ? columns.filter((column) => !hiddenColumns.includes(column.key as keyof Document))
    : columns;

  const handleRowSelect = (row: Document) => {
    if (!row.transferEventId) return;
    const TEI = row.transferEventId === selectedTransferEventId ? undefined : row.transferEventId;
    setSelectedTransferEventId(TEI);
    onTransferEventSelect?.(TEI);
    const RN = row.requisitionNumber === selectedRequisitionNumber ? undefined : row.requisitionNumber;
    setSelectedRequisitionNumber(RN);
    onRequisitionNumberSelect?.(RN);
    onAuthorizingTemplateSelect?.(RN ? row.name : undefined);
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

  const selectedRowKey =
    documents.find((d) => d.transferEventId === selectedTransferEventId)?.requisitionNumber ?? null;

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
        rowKey="requisitionNumber"
        onRowSelect={(onTransferEventSelect || onRequisitionNumberSelect) ? handleRowSelect : undefined}
        selectedRowKey={selectedRowKey}
      />
    </div>
  );
}