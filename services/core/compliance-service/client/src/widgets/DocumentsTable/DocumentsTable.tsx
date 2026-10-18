// File: services/core/compliance-service/client/src/widgets/DocumentsTable.tsx
import { Document } from 'compliance-shared';
import { DatabaseTwinTable, TableColumn } from '@shared/ui-components';
import { useDocuments } from '../../hooks';

const columns: TableColumn<Document>[] = [
  { key: 'id', header: 'Document ID' },
  { key: 'documentType', header: 'Document Type' },
  { 
    key: 'storageKey', 
    header: 'Storage Path (MinIO)',
    render: (_val, row) => (
      <span className="font-mono text-xs text-blue-400">
        s3://{row.storageBucket}/{row.storageKey}
      </span>
    )
  },
  { key: 'status', header: 'Status' },
  { 
    key: 'updatedAt', 
    header: 'Updated At',
    render: (val) => val ? new Date(String(val)).toLocaleString() : 'N/A'
  },
];

export default function DocumentsTable() {
  const { documents, loading, error } = useDocuments();

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
        columns={columns}
        rowKey="id"
      />
    </div>
  );
}