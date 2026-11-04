// File: service/core/audit-ledger/client/src/widgets/TransfersTable/TransfersTable.tsx
import { useState } from 'react';
import { DatabaseTwinTable, TableColumn } from '@shared/ui-components';
import { TransferSummary } from 'audit-shared';
import { useGetTransfers } from '../../hooks';

export default function TransfersTableWidget() {
  const { data: transfers, isLoading, error } = useGetTransfers();
  const [selectedRequisition, setSelectedRequisition] = useState<string | null>(null);

  const columns: TableColumn<TransferSummary>[] = [
    { key: 'requisitionNumber', header: 'Requisition #' },
    { 
      key: 'status', 
      header: 'Status',
      render: (value) => {
        const isSealed = value === 'SEALED';
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
        selectedRowKey={selectedRequisition}
        isRowSelectable={(row) => row.status === 'SEALED'}
        onRowSelect={(row) => {
          if (row.status === 'SEALED') {
            setSelectedRequisition(row.requisitionNumber);
            // Trigger detail view or verification action for sealed transfer
          }
        }}
      />
    </div>
  );
}