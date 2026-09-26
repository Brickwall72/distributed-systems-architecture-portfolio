// File: ui-shells/domain-shells/compliance-shell/src/App.tsx
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFederationRegistry } from '@shared/mf-runtime';
import { UnifiedCustodyPage, DocumentsPage } from './pages';
import { NavigationTabs } from './components';
import '@shared/styles';

export default function App() {
  const { isReady } = useFederationRegistry({ shellName: 'compliance_shell' });

  const isStandalone =
    window.location.pathname === '/compliance' ||
    window.location.pathname.startsWith('/compliance/');

  if (!isReady) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-900 text-slate-400 font-mono text-sm min-h-screen animate-pulse">
        Initializing Compliance Domain Registry...
      </div>
    );
  }

  return (
    <BrowserRouter basename={isStandalone ? '/compliance' : undefined}>
      <div className="h-full w-full flex flex-col space-y-6 p-6 bg-slate-900 text-slate-100 min-h-screen">
        {/* Shell Header & Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Compliance & Flight Clearance Domain</h2>
            <p className="text-sm text-slate-400">Manage cryptographic validation gates and review safety artifacts.</p>
          </div>
          <NavigationTabs />
        </div>

        {/* Dynamic Route View Container with Suspense Boundary */}
        <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/80 p-6 shadow-inner">
          <Suspense fallback={<div className="text-slate-400 font-mono py-12 text-center animate-pulse">Loading compliance micro-frontend module...</div>}>
            <Routes>
              <Route path="/" element={<UnifiedCustodyPage />} />
              <Route path="/custody" element={<UnifiedCustodyPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </BrowserRouter>
  );
}