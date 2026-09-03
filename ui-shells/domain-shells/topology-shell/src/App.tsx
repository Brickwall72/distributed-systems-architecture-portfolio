// File: ui-shells/domain-shells/topology-shell/src/App.tsx
import { Suspense } from 'react';
import TopologyDashboard from './pages/TopologyDashboard';

export default function App() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white">Topology Domain</h2>
        <p className="text-sm text-slate-400">Manage assets, commands, and rulesets.</p>
      </div>

      <Suspense fallback={<div className="text-slate-500 font-mono">Loading Topology Widget...</div>}>
        <TopologyDashboard />
      </Suspense>
    </div>
  );
}