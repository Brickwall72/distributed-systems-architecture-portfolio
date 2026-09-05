// File: ui-shells/global-shell/src/App.tsx

import { useEffect, useState, Suspense, ComponentType } from 'react';
import { ShellManifest, RemoteDomainModule } from '@shared/shell-contracts';
import { importDynamicRemote } from './utils/dynamicRemoteLoader';
import '@shared/styles';

interface LoadedRemote {
  config: RemoteDomainModule;
  Component: React.LazyExoticComponent<ComponentType<any>>;
}

export default function App() {
  const [manifest, setManifest] = useState<ShellManifest | null>(null);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [remoteCache, setRemoteCache] = useState<Record<string, LoadedRemote>>({});
  const [error, setError] = useState<string | null>(null);

  // Phase 1: Fetch Manifest on Shell Boot
  useEffect(() => {
    fetch('/ui-manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: ShellManifest) => {
        setManifest(data);
        if (data.remotes.length > 0) {
          setActiveDomainId(data.remotes[0].domainId);
        }
      })
      .catch((err) => setError(`Failed to load UI manifest: ${err.message}`));
  }, []);

  // Phase 2: Lazy compile remote upon tab selection
  useEffect(() => {
    if (!manifest || !activeDomainId || remoteCache[activeDomainId]) return;

    const config = manifest.remotes.find((r) => r.domainId === activeDomainId);
    if (config) {
      const Component = importDynamicRemote(config);
      setRemoteCache((prev) => ({
        ...prev,
        [activeDomainId]: { config, Component }
      }));
    }
  }, [activeDomainId, manifest, remoteCache]);

  if (error) {
    return <div className="p-6 bg-red-50 text-red-700 rounded-lg">{error}</div>;
  }

  if (!manifest) {
    return <div className="p-6 text-gray-500 font-mono">Bootstrapping Platform Shell OS...</div>;
  }

  const activeRemote = activeDomainId ? remoteCache[activeDomainId] : null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Shell Header Nav Bar - Driven entirely by manifest contents */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-bold text-lg text-white">Mission Operations Shell</h1>
        </div>

        <nav className="flex gap-2">
          {manifest.remotes.map((remote) => {
            const isActive = remote.domainId === activeDomainId;
            return (
              <button
                type="button"
                key={remote.domainId}
                onClick={() => setActiveDomainId(remote.domainId)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {remote.navLabel}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-1 p-6">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-gray-400 font-mono">
              Resolving remote module bundle...
            </div>
          }
        >
          {activeRemote ? (
            <activeRemote.Component />
          ) : (
            <div className="text-gray-500">Initializing selected domain workspace...</div>
          )}
        </Suspense>
      </main>
    </div>
  );
}