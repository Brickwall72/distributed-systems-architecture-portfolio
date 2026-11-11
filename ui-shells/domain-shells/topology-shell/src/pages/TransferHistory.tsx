// File: ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx
import { Suspense } from 'react';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import type { NetworkCanvasProps } from '@contracts/topology';
import { useIdentity } from '@shared/ui-components';
import '@shared/styles';

// Dynamically resolve autonomous widgets at runtime (now backed by populated registerRemotes)
const NetworkCanvas = lazyRemote<NetworkCanvasProps>('topology_client/NetworkCanvas');

export default function TransferHistory() {
  const identity = useIdentity();
  const organization = identity?.orgId ? [identity.orgId] : undefined;

  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Transfer History for Selected Assets</h1>
        <p className="text-sm text-slate-400 mt-1">Select assets on the graph to view their transfer history.</p>
      </header>
      <div className="mt-6">
        <FederatedErrorBoundary remoteName="topology_client/NetworkCanvas">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Network Canvas...
            </div>
          }>
            <NetworkCanvas
              enableAssetHistorySelection
              whitelistSenders={organization}
              whitelistReceivers={organization}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
    </div>
  );
}