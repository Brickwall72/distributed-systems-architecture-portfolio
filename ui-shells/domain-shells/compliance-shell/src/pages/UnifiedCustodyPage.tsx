// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, Suspense } from 'react';
import { lazyRemote } from '../utils/federation';
import { FederatedErrorBoundary } from '@shared/ui-components';
import type { ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import type { 
  // AssetDTO,
  AssetDTOList,
  // OrganizationDTO,
  OrganizationDTOList,
  AssetSelectorProps,
  OrganizationSelectorProps
} from '@contracts/topology';

// Dynamically resolve high-level bounded context widgets
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');

export default function UnifiedCustodyPage() {
  // 1. Topology Data Handlers
  const [sourceOrg, setSourceOrg] = useState<OrganizationDTOList>([]);
  const [targetOrg, setTargetOrg] = useState<OrganizationDTOList>([]);
  const [assets, setAssets] = useState<AssetDTOList>([]);

  return (
    <div className="flex flex-col h-screen p-6 gap-6 bg-slate-950 text-slate-100">
      
      {/* Step 1: Context Collection (Topology) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              label='Source Organization'
              excludeOrgId={targetOrg[0]?.id}
              filterOwnedId={assets[0]?.id}
              onSelect={setSourceOrg}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              label='Asset for Transfer'
              excludeOwnerId={targetOrg[0]?.id}
              filterOwnerId={sourceOrg[0]?.id}
              onSelect={setAssets}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              label='Target Organization'
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
              sourceOrg={sourceOrg[0]}
              assets={assets}
              targetOrg={targetOrg[0]}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </main>

    </div>
  );
}