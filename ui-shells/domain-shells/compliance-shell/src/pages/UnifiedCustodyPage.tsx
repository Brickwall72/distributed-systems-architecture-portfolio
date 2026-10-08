// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, useMemo, Suspense, lazy } from 'react';
import { lazyRemote } from '../utils/federation';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { FederatedErrorBoundary } from '@shared/ui-components';
import type { 
  // AssetBase,
  AssetBaseList,
  // OrganizationBase,
  OrganizationBaseList,
  AssetSelectorProps,
  OrganizationSelectorProps
} from '@contracts/topology';

// Dynamically resolve high-level bounded context widgets
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const ComplianceWorkflowWidget = lazy(() => loadRemote<any>('compliance_client/ComplianceWorkflowWidget'));

export default function UnifiedCustodyPage() {
  // 1. Topology Data Handlers
  const [sourceOrg, setSourceOrg] = useState<OrganizationBaseList>([]);
  const [targetOrg, setTargetOrg] = useState<OrganizationBaseList>([]);
  const [assets, setAssets] = useState<AssetBaseList>([]);

  // 2. Form Metadata Context
  const [requisitionNumber] = useState('REQ-2026-001');
  const [documentId] = useState(() => crypto.randomUUID());
  const [transferDate] = useState(new Date().toDateString());

  // 3. Map precise domain models to a flexible template contract
  const templatePayload = useMemo<Record<string, unknown> | null>(() => {
    if (!sourceOrg && !targetOrg && !assets) return null;

    return {
      sourceOrg: sourceOrg[0],
      targetOrg: targetOrg[0],
      asset: assets[0],
      requisitionNumber,
      transferDate,
      // Fallback flatteners for older templates
      releasingEntityName: sourceOrg[0]?.name ?? '',
      receivingEntityName: targetOrg[0]?.name ?? '',
      nomenclature: assets[0]?.name ?? '',
      // serialNumber: asset[0]?.serialNumber ?? '',
      items: assets ? [{ itemNumber: 1, nomenclature: assets[0]?.name, unit: 'EA', quantity: 1 }] : [],
    };
  }, [sourceOrg, targetOrg, assets, requisitionNumber, transferDate]);

  return (
    <div className="flex flex-col h-screen p-6 gap-6 bg-slate-950 text-slate-100">
      
      {/* Step 1: Context Collection (Topology) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              excludeOrgId={targetOrg[0]?.id}
              filterOwnedId={assets[0]?.id}
              onSelect={setSourceOrg}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              excludeOwnerId={targetOrg[0]?.id}
              filterOwnerId={sourceOrg[0]?.id}
              onSelect={setAssets}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              excludeOrgId={sourceOrg[0]?.id}
              onSelect={setTargetOrg}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
      {/* Step 2: Capability Execution (Compliance) */}
      <main className="flex-1">
        <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading compliance workflow...</div>}>
            <ComplianceWorkflowWidget
              templateData={templatePayload}
              documentId={documentId}
              requisitionNumber={requisitionNumber}
              signerId="usr_compliance_officer"
              entityId={sourceOrg[0]?.id ?? 'org_unassigned'}
              onWorkflowComplete={(url: string) => console.log('Final Signed Document:', url)}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </main>

    </div>
  );
}