// File: ui-shells/domain-shells/compoliance-shell/src/pages/TransferReceipt/TransferReceiptPage.tsx
import { useState, Suspense } from 'react';
import { useIdentity } from '@shared/ui-components';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import { ComplianceWorkflowWidgetProps, FormId, DocumentsTableInput } from '@contracts/compliance';
import { TRANSFER_STATUS } from '@contracts/common'
import { AssetDTOList, AssetSelectorProps, OrganizationSelectorProps, OrganizationDTO, TRANSFER_ROLE, TOPOLOGY_GRAPH_QUERY_KEY } from '@contracts/topology';

/** Intersects every active selection's requisition numbers; undefined when nothing is selected. */
function intersectRequisitions(sets: readonly (readonly string[] | undefined)[]): string[] | undefined {
  const active = sets.filter((set): set is readonly string[] => set !== undefined);
  if (active.length === 0) return undefined;
  return [...new Set(active[0])].filter((req) => active.every((set) => set.includes(req)));
}

// Dynamically resolve micro-frontend widgets
const DocumentsTable = lazyRemote<DocumentsTableInput>('compliance_client/DocumentsTable');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');
const graphQueries = [TOPOLOGY_GRAPH_QUERY_KEY] as const;

export default function TransferReceiptPage() {
  const identity = useIdentity();
  return <TransferReceiptSession key={JSON.stringify([identity?.id, identity?.orgId, identity?.roles])} identity={identity} />;
}

function TransferReceiptSession({ identity }: { readonly identity: ReturnType<typeof useIdentity> }) {
  const [assets, setAssets] = useState<AssetDTOList>([]);
  const [transferEventId, setTransferEventId] = useState<string>();
  const [requisitionNumber, setRequisitionNumber] = useState<string>();
  const [authorizingTemplateId, setAuthorizingTemplateId] = useState<FormId>();
  const [fromOrg, setFromOrg] = useState<OrganizationDTO>();
  const [receivingOrg, setReceivingOrg] = useState<OrganizationDTO>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [workflowResetKey, setWorkflowResetKey] = useState(0);
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [awaitingNewSelection, setAwaitingNewSelection] = useState(false);
  const [signedWorkflow, setSignedWorkflow] = useState<ComplianceWorkflowWidgetProps>();
  const [pendingAssets, setPendingAssets] = useState<Record<string, string[]>>({});

  const workflowProps: ComplianceWorkflowWidgetProps = {
    sourceOrg: fromOrg,
    targetOrg: receivingOrg,
    assets,
    requisitionNumber,
    authorizingTemplateId,
    transferEventId,
  };
  const beginSelection = () => {
    setAwaitingNewSelection(false);
    if (!signedWorkflow) return;
    setSignedWorkflow(undefined);
    setWorkflowResetKey((key) => key + 1);
  };

  const requisitionNumbers = intersectRequisitions([
    assets.length ? assets.flatMap((asset) => asset.requisitionNumber ?? []) : undefined,
    fromOrg?.requisitions,
    receivingOrg?.requisitions,
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Transfer Receipt Handling</h3>
        <p className="text-sm text-slate-400">Select associated authorization document, source organization, and received assets to populate receipt and then sign.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Documents Table */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col h-[600px] overflow-hidden">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Receivable In-Progress Transfers</h4>
          <div className="flex-1 overflow-auto">
            <FederatedErrorBoundary remoteName="DocumentsTable">
              <Suspense fallback={<div className="text-slate-500 font-mono py-12 text-center animate-pulse">Loading documents table...</div>}>
                <DocumentsTable
                  key={selectionResetKey}
                  onTransferEventSelect={(id) => setTransferEventId(id ?? undefined)}
                  onRequisitionNumberSelect={(value) => setRequisitionNumber(value ?? undefined)}
                  onAuthorizingTemplateSelect={setAuthorizingTemplateId}
                  statusFilter={[TRANSFER_STATUS.IN_PROGRESS, TRANSFER_STATUS.PARTIALLY_COMPLETED]}
                  requisitionNumbers={requisitionNumbers}
                  receivingOrganizationOnly
                  hiddenColumns={['type']}
                  refreshKey={refreshKey}
                  onUserSelect={beginSelection}
                />
              </Suspense>
            </FederatedErrorBoundary>
          </div>
        </div>

        {/* Middle Column: Multi-Select Asset Selector */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-4">
          <h4 className="text-sm font-medium text-slate-300">Asset Selection</h4>
          <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
            <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selector...</div>}>
              <OrganizationSelector
                key={`source-${selectionResetKey}`}
                label="From Organization"
                autoSelectSingle={!awaitingNewSelection}
                transferEventId={transferEventId}
                transferEventRole={TRANSFER_ROLE.SENDER}
                onSelect={setFromOrg}
                excludeOrgId={receivingOrg?.id}
                filterOwnedId={assets[0]?.id}
                refreshKey={refreshKey}
                onUserSelect={beginSelection}
              />
              <OrganizationSelector
                key={`receiver-${selectionResetKey}`}
                label="Receiving Organization"
                onlyOrgId={identity?.orgId ?? undefined}
                transferEventId={transferEventId}
                transferEventRole={TRANSFER_ROLE.RECEIVER}
                onSelect={setReceivingOrg}
                excludeOrgId={fromOrg?.id}
                refreshKey={refreshKey}
                onUserSelect={beginSelection}
              />
            </Suspense>
          </FederatedErrorBoundary>
          <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
            <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
              <AssetSelector
                key={selectionResetKey}
                label="Select Transferred Assets Received"
                includeInTransit={true}
                includeAvailable={false}
                filterOwnerId={fromOrg?.id}
                transferEventId={transferEventId}
                multiSelect={true}
                excludeAssetIds={Object.values(pendingAssets).flat()}
                onSelect={setAssets}
                refreshKey={refreshKey}
                onUserSelect={beginSelection}
              />
            </Suspense>
          </FederatedErrorBoundary>
          <div className="mt-2 text-xs text-slate-400 font-mono">
            Selected Assets: <span className="text-blue-400 font-semibold">{assets.length}</span>
            {' | '}From: <span className="text-blue-400 font-semibold">{fromOrg?.name ?? 'N/A'}</span>
            {' | '}Receiving: <span className="text-blue-400 font-semibold">{receivingOrg?.name ?? 'N/A'}</span>
          </div>
        </div>

        {/* Right Column: Compliance Workflow Widget */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col h-[650px]">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Compliance Sign-off</h4>
          <div className="flex-1 flex flex-col min-h-0">
            <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
              <Suspense fallback={<div className="text-slate-500 font-mono py-12 text-center animate-pulse">Loading compliance workflow...</div>}>
                <ComplianceWorkflowWidget
                  {...(signedWorkflow ?? workflowProps)}
                  resetKey={workflowResetKey}
                  invalidateQueryKeys={graphQueries}
                  onDocumentSaved={(documentId) => {
                    setSignedWorkflow(workflowProps);
                    setPendingAssets((pending) => ({ ...pending, [documentId]: assets.map((asset) => asset.id) }));
                    setAssets([]);
                    setFromOrg(undefined);
                    setReceivingOrg(undefined);
                    setTransferEventId(undefined);
                    setRequisitionNumber(undefined);
                    setAuthorizingTemplateId(undefined);
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
          </div>
        </div>
      </div>
    </div>
  );
}