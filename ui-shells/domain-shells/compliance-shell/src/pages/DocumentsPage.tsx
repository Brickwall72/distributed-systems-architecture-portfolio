// File: ui-shells/domain-shells/compliance-shell/src/pages/DocumentsPage.tsx
import { useEffect, useState } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { DatabaseTwinTable, TableColumn, FederatedErrorBoundary } from '@shared/ui-components';

// Local interface definition or shared contract type
interface ComplianceDocument {
  id: string;
  document_type: string;
  s3_uri: string;
  status: string;
  created_at: string;
}

const columns: TableColumn<ComplianceDocument>[] = [
  { key: 'id', header: 'Document ID' },
  { key: 'document_type', header: 'Document Type' },
  { 
    key: 's3_uri', 
    header: 'Storage Path (MinIO)',
    render: (val) => <span className="font-mono text-xs text-blue-400">{String(val)}</span>
  },
  { key: 'status', header: 'Status' },
  { 
    key: 'created_at', 
    header: 'Created At',
    render: (val) => new Date(String(val)).toLocaleString()
  },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadComplianceData() {
      try {
        // Dynamically resolve the compliance client API at runtime via the global registry,
        // removing build-time static import coupling entirely.
        const complianceApi = await loadRemote<any>('compliance_client/api');
        
        if (!complianceApi || typeof complianceApi.fetchDocuments !== 'function') {
          throw new Error('Failed to resolve fetchDocuments from compliance_client remote');
        }

        const data = await complianceApi.fetchDocuments();
        setDocuments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve dataset');
      } finally {
        setLoading(false);
      }
    }

    loadComplianceData();
  }, []);

  if (loading) {
    return (
      <div className="text-slate-400 font-mono py-16 text-center animate-pulse">
        Querying compliance-db database twin...
      </div>
    );
  }

  if (error) {
    return (
      <FederatedErrorBoundary remoteName="compliance_client/api">
        <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-lg text-red-200 space-y-1">
          <h4 className="font-semibold text-sm">Failed to load dataset view</h4>
          <p className="text-xs text-red-300/80">{error}</p>
        </div>
      </FederatedErrorBoundary>
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

      <FederatedErrorBoundary remoteName="DatabaseTwinTable">
        <DatabaseTwinTable 
          data={documents}
          columns={columns}
          rowKey="id"
        />
      </FederatedErrorBoundary>
    </div>
  );
}