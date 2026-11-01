// File: ui-shells/domain-shells/compliance-shell/src/pages/TransferReceiptPage.tsx
import { useState, Suspense } from 'react';
import { lazyRemote } from '../utils/federation';
import { FederatedErrorBoundary } from '@shared/ui-components';
import { ComplianceWorkflowWidgetProps, FormId } from '@contracts/compliance';
import { TRANSFER_STATUS } from '@contracts/common'
import { AssetDTOList, AssetSelectorProps, OrganizationSelectorProps, OrganizationDTO, TRANSFER_ROLE } from '@contracts/topology';

export interface DocumentsTableProps {
  /** Emits the selected row's transferEventId, or null when deselected. */
  readonly onTransferEventSelect?: (transferEventId: string | null) => void;
  readonly onRequisitionNumberSelect?: (requisitionNumber: string | null) => void;
  readonly onAuthorizingTemplateSelect?: (templateId: FormId | undefined) => void;
  /** Limits returned rows to these statuses (e.g. IN_PROGRESS, PARTIALLY_COMPLETED). */
  readonly statusFilter?: readonly (typeof TRANSFER_STATUS.IN_PROGRESS | typeof TRANSFER_STATUS.PARTIALLY_COMPLETED)[];
  /** Limits returned rows to these requisition numbers; an empty array matches nothing. */
  readonly requisitionNumbers?: readonly string[];
  readonly hiddenColumns?: readonly ('type' | 'transferType' | 'status' | 'updatedAt' | 'requisitionNumber')[];
}

/** Intersects every active selection's requisition numbers; undefined when nothing is selected. */
function intersectRequisitions(sets: readonly (readonly string[] | undefined)[]): string[] | undefined {
  const active = sets.filter((set): set is readonly string[] => set !== undefined);
  if (active.length === 0) return undefined;
  return [...new Set(active[0])].filter((req) => active.every((set) => set.includes(req)));
}

// Dynamically resolve micro-frontend widgets
const DocumentsTable = lazyRemote<DocumentsTableProps>('compliance_client/widget/DocumentsTable');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');

export default function TransferReceiptPage() {
  const [assets, setAssets] = useState<AssetDTOList>([]);
  const [transferEventId, setTransferEventId] = useState<string>();
  const [requisitionNumber, setRequisitionNumber] = useState<string>();
  const [authorizingTemplateId, setAuthorizingTemplateId] = useState<FormId>();
  const [fromOrg, setFromOrg] = useState<OrganizationDTO>();
  const [receivingOrg, setReceivingOrg] = useState<OrganizationDTO>();

  const requisitionNumbers = intersectRequisitions([
    assets.length ? assets.flatMap((asset) => asset.requisitionNumber ?? []) : undefined,
    fromOrg?.requisitions,
    receivingOrg?.requisitions,
  ]);

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Transfer Receipt Handling</h3>
        <p className="text-sm text-slate-400">Review receipt documents, select multiple transferred assets, and execute compliance sign-off.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Documents Table */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col h-[600px] overflow-hidden">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Receipt Documents</h4>
          <div className="flex-1 overflow-auto">
            <FederatedErrorBoundary remoteName="DatabaseTwinTable">
              <Suspense fallback={<div className="text-slate-500 font-mono py-12 text-center animate-pulse">Loading documents table...</div>}>
                <DocumentsTable
                  onTransferEventSelect={(id) => setTransferEventId(id ?? undefined)}
                  onRequisitionNumberSelect={(value) => setRequisitionNumber(value ?? undefined)}
                  onAuthorizingTemplateSelect={setAuthorizingTemplateId}
                  statusFilter={[TRANSFER_STATUS.IN_PROGRESS, TRANSFER_STATUS.PARTIALLY_COMPLETED]}
                  requisitionNumbers={requisitionNumbers}
                  hiddenColumns={['type']}
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
                label="From Organization"
                transferEventId={transferEventId}
                transferEventRole={TRANSFER_ROLE.SENDER}
                onSelect={setFromOrg}
                excludeOrgId={receivingOrg?.id}
                filterOwnedId={assets[0]?.id}
              />
              <OrganizationSelector
                label="Receiving Organization"
                transferEventId={transferEventId}
                transferEventRole={TRANSFER_ROLE.RECEIVER}
                onSelect={setReceivingOrg}
                excludeOrgId={fromOrg?.id}
              />
            </Suspense>
          </FederatedErrorBoundary>
          <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
            <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
              <AssetSelector
                label="Select Transferred Assets Received"
                includeInTransit={true}
                includeAvailable={false}
                filterOwnerId={fromOrg?.id}
                transferEventId={transferEventId}
                multiSelect={true}
                onSelect={setAssets}
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
                  sourceOrg={fromOrg}
                  targetOrg={receivingOrg}
                  assets={assets}
                  requisitionNumber={requisitionNumber}
                  authorizingTemplateId={authorizingTemplateId}
                  transferEventId={transferEventId}
                />
              </Suspense>
            </FederatedErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}