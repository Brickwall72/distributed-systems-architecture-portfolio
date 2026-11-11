// File: ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx
import { Suspense } from 'react';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import { NetworkCanvasInputs } from '@contracts/topology';
import '@shared/styles';

// Dynamically resolve autonomous widgets at runtime (now backed by populated registerRemotes)
const AssetRegistration = lazyRemote<any>('topology_client/AssetRegistration');
const NetworkCanvas = lazyRemote<NetworkCanvasInputs>('topology_client/NetworkCanvas');

export default function AssetRegistrationDashboard() {
  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Mission Control: Fleet Topology Graph</h1>
        <p className="text-sm text-slate-400 mt-1">Manage physical asset deployments and verify connectivity paths across the cluster mesh.</p>
      </header>

      {/* Layout engine assembling federated client widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FederatedErrorBoundary remoteName="topology_client/AssetRegistration">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Connection Form...
            </div>
          }>
            <AssetRegistration />
          </Suspense>
        </FederatedErrorBoundary>

        <FederatedErrorBoundary remoteName="topology_client/NetworkCanvas">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Network Canvas...
            </div>
          }>
            <NetworkCanvas />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
    </div>
  );
}