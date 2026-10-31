// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, Suspense, useEffect } from 'react';
import { lazyRemote } from '../utils/federation';
import { FederatedErrorBoundary } from '@shared/ui-components';
import { TRANSFER_TYPE, TransferType } from '@contracts/common';
import { 
  ComplianceWorkflowWidgetProps, 
  FORM_TYPE, 
  TemplateSelectorPropsInput, 
  TemplateDTOwithPayload 
} from '@contracts/compliance';
import { 
  AssetDTOList,
  CONTROL_TYPE,
  OrganizationDTO,
  OrganizationDTOList,
  AssetSelectorProps,
  OrganizationSelectorProps,
  ControlType
} from '@contracts/topology';

// Dynamically resolve high-level bounded context widgets
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const TemplateSelector = lazyRemote<TemplateSelectorPropsInput>('compliance_client/TemplateSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');

export default function UnifiedCustodyPage() {
  // 1. Topology Data Handlers
  const [sourceOrg, setSourceOrg] = useState<OrganizationDTO>();
  const [targetOrg, setTargetOrg] = useState<OrganizationDTO>();
  const [assets, setAssets] = useState<AssetDTOList>([]);
  const [transferType, setTransferType] = useState<TransferType>();
  const [controlType, setControlType] = useState<ControlType>();
  const [template, setTemplate] = useState<TemplateDTOwithPayload>();

  useEffect(() => {
    switch (assets[0]?.controlType) {
      case CONTROL_TYPE.LOCAL:
        setTransferType(TRANSFER_TYPE.PHYSICAL_TRANSFER);
        break;
      case CONTROL_TYPE.REMOTE:
        setTransferType(TRANSFER_TYPE.C2_TRANSFER);
        break;
      default:
        setTransferType(undefined);
    }
  }, [assets])

  useEffect(() => {
    if(template?.transferType === TRANSFER_TYPE.PHYSICAL_TRANSFER) setControlType(CONTROL_TYPE.LOCAL);
    else if (template?.transferType === TRANSFER_TYPE.C2_TRANSFER) setControlType(CONTROL_TYPE.REMOTE);
    else setControlType(undefined);
  }, [template]);

  const handleSourceOrgSelect = (orgs: OrganizationDTOList) => {
    setSourceOrg(orgs[0]);
  }

  const handleTargetOrgSelect = (orgs: OrganizationDTOList) => {
    setTargetOrg(orgs[0]);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-6 bg-slate-950 text-slate-100">
      
      {/* Step 1: Context Collection (Topology) */}
      <div className="flex flex-col gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="w-full md:max-w-sm">
        <FederatedErrorBoundary remoteName="compliance_client/TemplateSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading template selector...</div>}>
            <TemplateSelector
              label="Compliance Form"
              typeFilter={FORM_TYPE.AUTHORIZATION}
              transferTypeFilter={transferType}
              onSelect={setTemplate}
            />
          </Suspense>
        </FederatedErrorBoundary>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              label='Source Organization'
              excludeOrgId={targetOrg?.id}
              filterOwnedId={assets[0]?.id}
              onSelect={handleSourceOrgSelect}
              requireActiveAssets={true}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              label='Asset for Transfer'
              excludeOwnerId={targetOrg?.id}
              filterOwnerId={sourceOrg?.id}
              filterControlType = {controlType}
              includeInTransit={false}
              multiSelect={true}
              onSelect={setAssets}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              label='Target Organization'
              excludeOrgId={sourceOrg?.id}
              onSelect={handleTargetOrgSelect}
            />
          </Suspense>
        </FederatedErrorBoundary>
        </div>
      </div>
      {/* Step 2: Capability Execution (Compliance) */}
      <main className="flex-1 min-h-0 flex flex-col">
        <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading compliance workflow...</div>}>
            <ComplianceWorkflowWidget
              sourceOrg={sourceOrg}
              assets={assets}
              targetOrg={targetOrg}
              template={template}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </main>

    </div>
  );
}