// File: ui-shells/global-shell/src/App.tsx
import { useState, Suspense, ComponentType, lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { FederatedErrorBoundary } from '@shared/ui-components';
import '@shared/styles';

// Dynamically resolve domain shells at runtime via the global peer registry (initialized in main.tsx)
const TopologyApp = lazy(() => loadRemote<any>('topology_shell/App'));
const ComplianceApp = lazy(() => loadRemote<any>('compliance_shell/App'));

interface DomainTab {
  domainId: string;
  navLabel: string;
  Component: ComponentType<any>;
}

const DOMAINS: DomainTab[] = [
  {
    domainId: 'topology',
    navLabel: 'Fleet Topology',
    Component: TopologyApp,
  },
  {
    domainId: 'compliance',
    navLabel: 'Flight Compliance',
    Component: ComplianceApp,
  },
];

export default function App() {
  const [activeDomainId, setActiveDomainId] = useState<string>('topology');

  const activeDomain = DOMAINS.find((d) => d.domainId === activeDomainId) || DOMAINS[0];
  const ActiveComponent = activeDomain.Component;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Shell Header Nav Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-bold text-lg text-white">Mission Operations Shell</h1>
        </div>

        <nav className="flex gap-2">
          {DOMAINS.map((domain) => {
            const isActive = domain.domainId === activeDomainId;
            return (
              <button
                type="button"
                key={domain.domainId}
                onClick={() => setActiveDomainId(domain.domainId)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {domain.navLabel}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Viewport Container with Fault Isolation */}
      <main className="flex-1 p-6">
        <FederatedErrorBoundary remoteName={`${activeDomain.domainId}_shell/App`}>
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-gray-400 font-mono py-24 animate-pulse">
                Resolving remote domain shell bundle...
              </div>
            }
          >
            <ActiveComponent />
          </Suspense>
        </FederatedErrorBoundary>
      </main>
    </div>
  );
}