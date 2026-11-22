// File: ui-shells/domain-shells/topology-shell/src/App.tsx
import { Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { useFederationRegistry } from '@shared/mf-runtime';
import { AssetRegistrationDashboard, TransferHistory } from './pages';
import { NavigationTabs } from './components';
import '@shared/styles';

export default function App() {
  const basename = ['/topology-shell', '/topology'].find(
    (base) => window.location.pathname === base || window.location.pathname.startsWith(`${base}/`),
  );

  const { isReady } = useFederationRegistry({ shellName: 'topology_shell' });

  if (!isReady) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-900 text-slate-400 font-mono text-sm min-h-screen animate-pulse">
        Initializing Topology Domain Registry...
      </div>
    );
  }

  return (
    <BrowserRouter basename={basename}>
      <div className="h-full w-full flex flex-col space-y-6 p-6 bg-slate-900 text-slate-100 min-h-screen">
        {/* Shell Header & Navigation Bar */}
        <div className="flex flex-col items-center text-center border-b border-slate-800 pb-4 gap-4">
          <div>
            <h2 className="text-center text-xl font-bold text-white tracking-wide">Fleet Topology</h2>
            <p className="ui-text-muted-dark">Manage asset registration and transfer history.</p>
          </div>
          <NavigationTabs />
        </div>

        {/* Dynamic Route View Container with Suspense Boundary */}
        <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/80 p-6 shadow-inner">
          <Suspense fallback={<div className="text-slate-500 font-mono">Loading Topology Dashboard...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/asset-registration" replace />} />
              <Route path="/asset-registration" element={<AssetRegistrationDashboard />} />
              <Route path="/transfer-history" element={<TransferHistory />} />
              <Route path="*" element={<Navigate to="/asset-registration" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </BrowserRouter>
  );
}