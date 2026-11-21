// File: ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization.page.tsx
import { useState, Suspense, useEffect } from 'react';
import { useIdentity } from '@shared/ui-components';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
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
  AssetSelectorProps,
  OrganizationSelectorProps,
  ControlType,
  TOPOLOGY_GRAPH_QUERY_KEY,
} from '@contracts/topology';

// Dynamically resolve high-level bounded context widgets
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const TemplateSelector = lazyRemote<TemplateSelectorPropsInput>('compliance_client/TemplateSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');
const graphQueries = [TOPOLOGY_GRAPH_QUERY_KEY] as const;

export default function TransferAuthorizationPage() {
  const identity = useIdentity();
  return <TransferAuthorizationSession key={JSON.stringify([identity?.id, identity?.orgId, identity?.roles])} identity={identity} />;
}

function TransferAuthorizationSession({ identity }: { readonly identity: ReturnType<typeof useIdentity> }) {
  // 1. Topology Data Handlers
  const [sourceOrg, setSourceOrg] = useState<OrganizationDTO>();
  const [targetOrg, setTargetOrg] = useState<OrganizationDTO>();
  const [assets, setAssets] = useState<AssetDTOList>([]);
  const [transferType, setTransferType] = useState<TransferType>();
  const [controlType, setControlType] = useState<ControlType>();
  const [template, setTemplate] = useState<TemplateDTOwithPayload>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [workflowResetKey, setWorkflowResetKey] = useState(0);
  const [awaitingNewSelection, setAwaitingNewSelection] = useState(false);
  const [signedWorkflow, setSignedWorkflow] = useState<ComplianceWorkflowWidgetProps>();
  const [pendingAssets, setPendingAssets] = useState<Record<string, string[]>>({});

  const workflowProps: ComplianceWorkflowWidgetProps = { sourceOrg, assets, targetOrg, template };
  const beginSelection = () => {
    setAwaitingNewSelection(false);
    if (!signedWorkflow) return;
    setSignedWorkflow(undefined);
    setWorkflowResetKey((key) => key + 1);
  };

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

  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-6 bg-slate-950 text-slate-100">
      
      {/* Step 1: Context Collection (Topology) */}
      <div className="ui-surface-dark flex flex-col gap-4 p-4">
        <div className="w-full md:max-w-sm">
        <FederatedErrorBoundary remoteName="compliance_client/TemplateSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading template selector...</div>}>
            <TemplateSelector
              key={selectionResetKey}
              label="Compliance Form"
              typeFilter={FORM_TYPE.AUTHORIZATION}
              transferTypeFilter={transferType}
              onSelect={setTemplate}
              onUserSelect={beginSelection}
              autoSelectSingle={!awaitingNewSelection}
            />
          </Suspense>
        </FederatedErrorBoundary>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              label='Source Organization'
              onlyOrgId={identity?.orgId ?? undefined}
              excludeOrgId={targetOrg?.id}
              filterOwnedId={assets[0]?.id}
              onSelect={setSourceOrg}
              requireActiveAssets={true}
              refreshKey={refreshKey}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              key={selectionResetKey}
              label='Asset for Transfer'
              excludeOwnerId={targetOrg?.id}
              filterOwnerId={sourceOrg?.id}
              filterControlType = {controlType}
              includeInTransit={false}
              multiSelect={true}
              excludeAssetIds={Object.values(pendingAssets).flat()}
              onSelect={setAssets}
              onUserSelect={beginSelection}
              refreshKey={refreshKey}
            />
          </Suspense>
        </FederatedErrorBoundary>
        <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selectors...</div>}>
            <OrganizationSelector
              key={selectionResetKey}
              label='Target Organization'
              excludeOrgId={sourceOrg?.id}
              onSelect={setTargetOrg}
              onUserSelect={beginSelection}
              autoSelectSingle={!awaitingNewSelection}
              refreshKey={refreshKey}
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
              {...(signedWorkflow ?? workflowProps)}
              resetKey={workflowResetKey}
              invalidateQueryKeys={graphQueries}
              onDocumentSaved={(documentId) => {
                setSignedWorkflow(workflowProps);
                setPendingAssets((pending) => ({ ...pending, [documentId]: assets.map((asset) => asset.id) }));
                setAssets([]);
                setTargetOrg(undefined);
                setTemplate(undefined);
                setAwaitingNewSelection(true);
                setSelectionResetKey((key) => key + 1);
                setRefreshKey((key) => key + 1);
              }}
              onTopologyApplied={(documentId) => {
                setPendingAssets((pending) => {
                  const next = { ...pending };
                  delete next[documentId];
                  return next;
                });
                setRefreshKey((key) => key + 1);
              }}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </main>

    </div>
  );
}