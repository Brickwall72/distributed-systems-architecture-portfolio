// File: ui-shells/domain-shells/compliance-shell/src/pages/DocumentsPage.tsx
import { lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { FederatedErrorBoundary } from '@shared/ui-components';

// Local interface definition or shared contract type
const DocumentsTable = lazy(() => loadRemote<any>('compliance_client/DocumentsTable'));
const TransfersTable = lazy(() => loadRemote<any>('audit_client/TransfersTable'));

export default function DocumentsPage() {
  return (
    <>
      <FederatedErrorBoundary remoteName="DocumentsTable">
        <DocumentsTable />
      </FederatedErrorBoundary>
      <FederatedErrorBoundary remoteName="TransfersTable">
        <TransfersTable />
      </FederatedErrorBoundary>
    </>
  );
}