// File: ui-shells/global-shell/src/App.tsx
import { useEffect, useState, Suspense, ComponentType } from 'react';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import '@shared/styles';

// Dynamically resolve domain shells at runtime via the global peer registry (initialized in main.tsx)
const TopologyApp = lazyRemote<any>('topology_shell/App');
const ProfileSelector = lazyRemote<any>('auth_client/ProfileSelector');
const ComplianceApp = lazyRemote<any>('compliance_shell/App');

interface DomainTab {
  domainId: string;
  navLabel: string;
  Component: ComponentType<any>;
  defaultPath: string;
  paths: readonly string[];
}

const DOMAINS: DomainTab[] = [
  {
    domainId: 'topology',
    navLabel: 'Fleet',
    Component: TopologyApp,
    defaultPath: '/asset-registration',
    paths: ['/asset-registration', '/transfer-history'],
  },
  {
    domainId: 'compliance',
    navLabel: 'Transfers',
    Component: ComplianceApp,
    defaultPath: '/transfer-authorizations',
    paths: ['/transfer-authorizations', '/transfer-receipts', '/documents'],
  },
];

function domainForPath(pathname: string): DomainTab {
  const path = pathname.replace(/\/+$/, '') || '/';
  return DOMAINS.find((domain) => domain.paths.includes(path)) ?? DOMAINS[0];
}

export default function App() {
  const [activeDomainId, setActiveDomainId] = useState(() => domainForPath(window.location.pathname).domainId);

  useEffect(() => {
    const handlePopState = () => setActiveDomainId(domainForPath(window.location.pathname).domainId);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeDomain = DOMAINS.find((d) => d.domainId === activeDomainId) || DOMAINS[0];
  const ActiveComponent = activeDomain.Component;
  const handleDomainChange = (domain: DomainTab) => {
    if (domain.domainId === activeDomainId) {
      return;
    }

    window.history.pushState(null, '', domain.defaultPath);
    setActiveDomainId(domain.domainId);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Shell Header Nav Bar */}
      <header className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 px-6 py-3 flex flex-wrap items-center gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-bold text-lg text-white">Mission Operations</h1>
        </div>

        <nav className="flex gap-2">
          {DOMAINS.map((domain) => {
            const isActive = domain.domainId === activeDomainId;
            return (
              <button
                type="button"
                key={domain.domainId}
                onClick={() => handleDomainChange(domain)}
                className={`w-28 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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

        <div className="ml-auto min-w-56">
          <FederatedErrorBoundary remoteName="auth_client/ProfileSelector">
            <Suspense fallback={<span className="text-sm text-gray-400">Loading profiles...</span>}>
              <ProfileSelector />
            </Suspense>
          </FederatedErrorBoundary>
        </div>
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