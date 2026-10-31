// File: ui-shells/domain-shells/compliance-shell/src/pages/TransferReceiptPage.tsx
import { useState, Suspense } from 'react';
import { lazyRemote } from '../utils/federation';
import { FederatedErrorBoundary } from '@shared/ui-components';
import { ComplianceWorkflowWidgetProps, TemplateDTOwithPayload } from '@contracts/compliance';
import { AssetDTOList, AssetSelectorProps } from '@contracts/topology';

// Dynamically resolve micro-frontend widgets
const DocumentsTable = lazyRemote<any>('compliance_client/widget/DocumentsTable');
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const ComplianceWorkflowWidget = lazyRemote<ComplianceWorkflowWidgetProps>('compliance_client/ComplianceWorkflowWidget');

export default function TransferReceiptPage() {
  const [assets, setAssets] = useState<AssetDTOList>([]);
  const [template] = useState<TemplateDTOwithPayload>();

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
                <DocumentsTable />
              </Suspense>
            </FederatedErrorBoundary>
          </div>
        </div>

        {/* Middle Column: Multi-Select Asset Selector */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-4">
          <h4 className="text-sm font-medium text-slate-300">Asset Selection</h4>
          <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
            <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
              <AssetSelector
                label="Select Transferred Assets Received"
                includeInTransit={true}
                multiSelect={true}
                onSelect={setAssets}
              />
            </Suspense>
          </FederatedErrorBoundary>
          <div className="mt-2 text-xs text-slate-400 font-mono">
            Selected Assets: <span className="text-blue-400 font-semibold">{assets.length}</span>
          </div>
        </div>

        {/* Right Column: Compliance Workflow Widget */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col h-[650px]">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Compliance Sign-off</h4>
          <div className="flex-1 flex flex-col min-h-0">
            <FederatedErrorBoundary remoteName="compliance_client/ComplianceWorkflowWidget">
              <Suspense fallback={<div className="text-slate-500 font-mono py-12 text-center animate-pulse">Loading compliance workflow...</div>}>
                <ComplianceWorkflowWidget
                  assets={assets}
                  template={template}
                />
              </Suspense>
            </FederatedErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}