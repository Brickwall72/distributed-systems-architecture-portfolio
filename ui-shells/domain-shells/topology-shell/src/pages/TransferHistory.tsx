// File: ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx
import { Suspense, useState } from 'react';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import { NetworkCanvasInputs, AssetSelectorProps, AssetDTOList } from '@contracts/topology';
import '@shared/styles';

// Dynamically resolve autonomous widgets at runtime (now backed by populated registerRemotes)
const AssetSelector = lazyRemote<AssetSelectorProps>('topology_client/AssetSelector');
const NetworkCanvas = lazyRemote<NetworkCanvasInputs>('topology_client/NetworkCanvas');

export default function TransferHistory() {
  const [assets, setAssets] = useState<string[]>([]);
  const handleAssetSelect = (assetList: AssetDTOList) => {
    setAssets(assetList.map((asset) => asset.id));
  };

  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Transfer History for Selected Assets</h1>
        <p className="text-sm text-slate-400 mt-1">View transfer history for selected assets.</p>
      </header>
      <FederatedErrorBoundary remoteName="topology_client/AssetSelector">
          <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading asset selector...</div>}>
            <AssetSelector
              label='Asset(s)'
              includeInTransit={true}
              multiSelect={true}
              onSelect={handleAssetSelect}
            />
          </Suspense>
        </FederatedErrorBoundary>
      {/* Full-width network canvas for selected assets */}
      <div className="mt-6">
        <FederatedErrorBoundary remoteName="topology_client/NetworkCanvas">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Network Canvas...
            </div>
          }>
            <NetworkCanvas 
              whitelistAssets={assets}
              includeCompletedTransferEvents={true}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
    </div>
  );
}