// File: service/core/audit-ledger/client/src/widgets/TransfersTable/TransfersTable.tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseTwinTable, TableColumn, useIdentity } from '@shared/ui-components';
import { TransferSummary, RENDITION_STATUS, LEDGER_STATUS } from 'audit-shared';
import { useGetTransfers, useGetTransferPdf } from '../../hooks';

type PreviewEvent =
  | { type: 'select'; documentId: string; identityId: string }
  | { type: 'ready'; documentId: string; identityId: string; blob: Blob }
  | { type: 'error'; documentId: string; identityId: string; message: string }
  | { type: 'clear' };

export default function TransfersTableWidget({ onPdfSelect }: { onPdfSelect?: (event: PreviewEvent) => void } = {}) {
  const identity = useIdentity();
  const identityId = identity?.id;
  const previousIdentity = useRef(identityId);
  const queryClient = useQueryClient();
  const { data: transfers, isLoading, error } = useGetTransfers();
  const [selection, setSelection] = useState<{ requisition: string; identityId: string }>();
  const selectedRequisition = selection && selection.identityId === identityId ? selection.requisition : undefined;
  const selected = transfers?.find((transfer) => transfer.requisitionNumber === selectedRequisition);
  const { data: pdf, error: pdfError } = useGetTransferPdf(
    onPdfSelect && selected?.renditionStatus === RENDITION_STATUS.READY ? selectedRequisition : undefined,
  );

  useEffect(() => {
    if (previousIdentity.current === identityId) return;
    const oldIdentity = previousIdentity.current;
    previousIdentity.current = identityId;
    setSelection(undefined);
    onPdfSelect?.({ type: 'clear' });
    if (oldIdentity) queryClient.removeQueries({ queryKey: ['audit-ledger', 'transfer-pdf', oldIdentity] });
  }, [identityId, onPdfSelect, queryClient]);

  useEffect(() => {
    if (!selectedRequisition || !identityId || !onPdfSelect || !selected) return;
    if (selected.renditionStatus !== RENDITION_STATUS.READY) {
      onPdfSelect({ type: 'error', documentId: selectedRequisition, identityId, message: 'Transfer overview is not ready yet.' });
    } else if (pdf) {
      onPdfSelect({ type: 'ready', documentId: selectedRequisition, identityId, blob: pdf });
    } else if (pdfError) {
      onPdfSelect({ type: 'error', documentId: selectedRequisition, identityId, message: pdfError.message });
    }
  }, [selectedRequisition, identityId, onPdfSelect, selected?.renditionStatus, pdf, pdfError]);

  const columns: TableColumn<TransferSummary>[] = [
    { key: 'requisitionNumber', header: 'Requisition #' },
    { 
      key: 'status', 
      header: 'Status',
      render: (value) => {
        const isSealed = value === LEDGER_STATUS.SEALED;
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isSealed 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          }`}>
            {String(value)}
          </span>
        );
      }
    },
    { key: 'transferType', header: 'Type', render: (val) => val ? String(val) : '—' },
    { key: 'sequence', header: 'Sequence', render: (val) => val !== undefined ? `#${val}` : '—' },
    { key: 'renditionStatus', header: 'PDF', render: (val) => val ? String(val) : '—' },
    { 
      key: 'sealedAt', 
      header: 'Sealed At', 
      render: (val) => val ? new Date(String(val)).toLocaleString() : '—' 
    },
    { 
      key: 'updatedAt', 
      header: 'Updated At', 
      render: (val) => new Date(String(val)).toLocaleString() 
    },
  ];

  if (!identity) {
    return <div className="p-4 text-sm text-slate-400">Select a profile to view audit ledger transfers.</div>;
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-400">Loading audit ledger transfers...</div>;
  }

  if (error || !transfers) {
    return <div className="p-4 text-sm text-red-400">Failed to load transfer ledger data.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200">Audit Ledger Transfers</h2>
        <span className="text-xs text-gray-400">Showing {transfers.length} records</span>
      </div>

      <DatabaseTwinTable
        columns={columns}
        data={transfers}
        rowKey="requisitionNumber"
        selectedRowKey={selectedRequisition ?? null}
        isRowSelectable={(row) => row.status === LEDGER_STATUS.SEALED}
        onRowSelect={(row) => {
          if (row.status === LEDGER_STATUS.SEALED && identityId) {
            if (selectedRequisition === row.requisitionNumber) {
              setSelection(undefined);
              onPdfSelect?.({ type: 'clear' });
            } else {
              setSelection({ requisition: row.requisitionNumber, identityId });
              onPdfSelect?.({ type: 'select', documentId: row.requisitionNumber, identityId });
            }
          }
        }}
      />
    </div>
  );
}