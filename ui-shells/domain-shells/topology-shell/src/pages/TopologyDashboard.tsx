// File: ui-shells/domain-shells/topology-shell/src/pages/TopologyDashboard.tsx
import { Suspense, lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { FederatedErrorBoundary } from '@shared/ui-components';
import '@shared/styles';

// Dynamically resolve autonomous widgets at runtime (now backed by populated registerRemotes)
const ConnectionFormWidget = lazy(() => loadRemote<any>('topology_client/widget/ConnectionForm'));
const NetworkCanvasWidget = lazy(() => loadRemote<any>('topology_client/widget/NetworkCanvas'));

export default function TopologyDashboard() {
  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Mission Control: Fleet Topology Graph</h1>
        <p className="text-sm text-slate-400 mt-1">Manage physical asset deployments and verify connectivity paths across the cluster mesh.</p>
      </header>

      {/* Layout engine assembling federated client widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FederatedErrorBoundary remoteName="topology_client/widget/ConnectionForm">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Connection Form...
            </div>
          }>
            <ConnectionFormWidget />
          </Suspense>
        </FederatedErrorBoundary>

        <FederatedErrorBoundary remoteName="topology_client/widget/NetworkCanvas">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Network Canvas...
            </div>
          }>
            <NetworkCanvasWidget />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
    </div>
  );
}