// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, useMemo, Suspense, lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { Organization, Asset } from '@contracts/custody';
import { FederatedErrorBoundary } from '@shared/ui-components';

// Dynamically resolve high-level bounded context widgets
const OrganizationSelector = lazy(() => loadRemote<any>('topology_client/widget/OrganizationSelector'));
const AssetSelector = lazy(() => loadRemote<any>('topology_client/widget/AssetSelector'));
const ComplianceWorkflow = lazy(() => loadRemote<any>('compliance_client/widget/ComplianceWorkflow'));

export default function UnifiedCustodyPage() {
  // 1. Selector States
  const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading source selector...</div>}>
            <OrganizationSelector
              label="1. Transferring Entity (From)"
              selectedId={sourceOrg?.id}
              excludeId={targetOrg?.id}
              onChange={setSourceOrg}
            />
          </Suspense>
        </FederatedErrorBoundary>

        <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              label="2. Asset Selection"
              selectedId={asset?.id}
              ownerId={sourceOrg?.id}
              onChange={setAsset}
            />
          </Suspense>
        </FederatedErrorBoundary>

        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading target selector...</div>}>
            <OrganizationSelector
              label="3. Receiving Entity (To)"
              selectedId={targetOrg?.id}
              excludeId={sourceOrg?.id}
              onChange={setTargetOrg}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </div>

      {/* Step 2: Capability Execution (Compliance) */}
      <main className="flex-1">
        <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading compliance workflow...</div>}>
            <ComplianceWorkflow
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