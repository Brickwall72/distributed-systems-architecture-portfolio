// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, useMemo, Suspense, lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { Organization, Asset } from '@contracts/custody';
import { FederatedErrorBoundary } from '@shared/ui-components';

// Dynamically resolve high-level bounded context widgets
const CustodyTransferSelector = lazy(() => loadRemote<any>('topology_client/CustodyTransferSelector'));
const ComplianceWorkflowWidget = lazy(() => loadRemote<any>('compliance_client/ComplianceWorkflowWidget'));

export default function UnifiedCustodyPage() {
  // 1. Selector States (Managed as a single block from the Topology domain)
  const [transferState, setTransferState] = useState<{
    sourceOrg: Organization | null;
    targetOrg: Organization | null;
    asset: Asset | null;
  }>({
    sourceOrg: null,
    targetOrg: null,
    asset: null,
  });

  const { sourceOrg, targetOrg, asset } = transferState;

  // 2. Form Metadata Context
  const [requisitionNumber] = useState('REQ-2026-001');
  const [documentId] = useState(() => crypto.randomUUID());
  const [transferDate] = useState(new Date().toDateString());

  // 3. Map precise domain models to a flexible template contract
  const templatePayload = useMemo<Record<string, unknown> | null>(() => {
    if (!sourceOrg && !targetOrg && !asset) return null;

    return {
      sourceOrg,
      targetOrg,
      asset,
      requisitionNumber,
      transferDate,
      // Fallback flatteners for older templates
      releasingEntityName: sourceOrg?.name ?? '',
      receivingEntityName: targetOrg?.name ?? '',
      nomenclature: asset?.nomenclature ?? '',
      serialNumber: asset?.serialNumber ?? '',
      items: asset ? [{ itemNumber: 1, nomenclature: asset.nomenclature, serialNumber: asset.serialNumber, unit: 'EA', quantity: 1 }] : [],
    };
  }, [sourceOrg, targetOrg, asset, requisitionNumber, transferDate]);

  return (
    <div className="flex flex-col h-screen p-6 gap-6 bg-slate-950 text-slate-100">
      
      {/* Step 1: Context Collection (Topology) */}
      <FederatedErrorBoundary remoteName="topology_client/CustodyTransferSelector">
        <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading transfer selectors...</div>}>
          <CustodyTransferSelector onStateChange={setTransferState} />
        </Suspense>
      </FederatedErrorBoundary>

      {/* Step 2: Capability Execution (Compliance) */}
      <main className="flex-1">
        <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading compliance workflow...</div>}>
            <ComplianceWorkflowWidget
              templateData={templatePayload}
              documentId={documentId}
              requisitionNumber={requisitionNumber}
              signerId="usr_compliance_officer"
              entityId={sourceOrg?.id ?? 'org_unassigned'}
              onWorkflowComplete={(url: string) => console.log('Final Signed Document:', url)}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </main>

    </div>
  );
}