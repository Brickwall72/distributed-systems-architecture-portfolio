// File: ui-shells/domain-shells/topology-shell/src/pages/TopologyDashboard.tsx
import { Suspense, lazy } from 'react';
import '@shared/styles';

// Dynamically consume the autonomous widgets from the federated remote
const ConnectionFormWidget = lazy(() => import('topology_service/ConnectionFormWidget'));
const NetworkCanvasWidget = lazy(() => import('topology_service/NetworkCanvasWidget'));

export default function TopologyDashboard() {
  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Mission Control: Fleet Topology Graph</h1>
        <p className="text-sm text-slate-400 mt-1">Manage physical asset deployments and verify connectivity paths across the cluster mesh.</p>
      </header>

      {/* The shell acts purely as the layout engine, assembling autonomous federated modules */}
      <Suspense fallback={<div className="text-slate-500 font-mono">Loading Topology Widgets...</div>}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ConnectionFormWidget />
          <NetworkCanvasWidget />
        </div>
      </Suspense>
    </div>
  );
}