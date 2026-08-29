// File: ui-shells/global-shell/src/App.tsx
import { lazy, Suspense } from 'react';

/**
 * Lazy-loaded remote application mounted inside the shell host.
 *
 * This shell intentionally defers the topology microfrontend until it is needed
 * so the host page loads quickly while keeping the remote integration isolated.
 */
const TopologyApp = lazy(() => import('topology_service/App'));

export default function App() {
  return (
    <div style={{ padding: '20px', border: '2px dashed blue' }}>
      <h1>Welcome to the UI Shell Host</h1>
      <Suspense fallback={<div>Loading Topology Microservice...</div>}>
        <TopologyApp />
      </Suspense>
    </div>
  );
}
