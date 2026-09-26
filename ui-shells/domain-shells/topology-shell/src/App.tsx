// File: ui-shells/domain-shells/topology-shell/src/App.tsx
import { Suspense } from 'react';
import { useFederationRegistry } from '@shared/mf-runtime';
import TopologyDashboard from './pages/TopologyDashboard';
import '@shared/styles';

export default function App() {
    const { isReady } = useFederationRegistry({ shellName: 'topology_shell' });

  if (!isReady) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-900 text-slate-400 font-mono text-sm min-h-screen animate-pulse">
        Initializing Topology Domain Registry...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white">Topology Domain</h2>
        <p className="text-sm text-slate-400">Manage assets, commands, and rulesets.</p>
      </div>

      <Suspense fallback={<div className="text-slate-500 font-mono">Loading Topology Dashboard...</div>}>
        <TopologyDashboard />
      </Suspense>
    </div>
  );
}